import { useState, useEffect, useRef, useMemo } from 'react'
import { sfx } from '../lib/juice'

// ═════════════════════════════════════════════════════════════════════════════
// The season page's flow, shared by soccer's and baseball's season pages (SoccerSimPage, BaseballSimPage):
// basketball's progression (BucketSimPage) in pieces, so every sport's season unfolds the same way:
//   the build · the regular season (a beat of "Simulating season…", then game by game: the record ticks, a dot a
//   game, the wire; then the table, his line and the season awards, tallied one card at a time) · the playoffs
//   (a start button over the bracket, then every game played live on a scoreboard with Slowest / Slow / pause /
//   Fast / Skip, a timer bar between rounds, the title or the exit) · the legacy screen · the final report.
// The markup is basketball's (simp-*, plf-*, sawd-*, goat-*, bsim-*); each sport dresses it in its own colours.
// No always-on loops: every timer here stops when its stage is over.
// ═════════════════════════════════════════════════════════════════════════════

export const reducedMotion = () => typeof document !== 'undefined' && (document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// a club colour as text on the dark scoreboard: too dark to read (navy, black) gives way to its second colour, then to `alt`
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim()); if (!m) return null; const n = parseInt(m[1], 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
export const readable = (c1, c2, alt = '#f4f4f5') => [c1, c2].find(c => (lum(c) ?? 0) > 0.06) ?? alt

// Runs `fn` once when the page really goes away. React's development double mount (StrictMode mounts, unmounts and
// mounts again) used to fire a page's leave-booking on its first render: the season was booked (and the director
// finalized) before a game was played, so the moments' changes never reached the booked season.
export function useOnLeave(fn) {
  const f = useRef(fn); f.current = fn
  const gen = useRef(0)
  useEffect(() => {
    const me = ++gen.current
    return () => { setTimeout(() => { if (gen.current === me) f.current?.() }, 0) }
  }, [])
}

export function ProgressDots({ screen, total }) {
  return <div className="simp-dots">{Array.from({ length: total }, (_, i) => <div key={i} className={`simp-dot ${i === screen ? 'simp-dot-active' : i < screen ? 'simp-dot-done' : ''}`} />)}</div>
}

export function SimLoading({ label = 'Simulating season…' }) {
  return (
    <div className="simp-loading">
      <div className="simp-loading-dot" /><div className="simp-loading-dot" /><div className="simp-loading-dot" />
      <div className="simp-loading-lbl">{label}</div>
    </div>
  )
}

// The regular season, revealed: a beat of loading, then one game every `pace` ms (basketball's: 900 ms, then the
// 82 games in about six seconds). `instant`: already seen, every game out at once.
export function useSeasonReveal(total, { pace = 60, instant = false } = {}) {
  const [n, setN] = useState(instant ? total : 0)
  const [phase, setPhase] = useState(instant ? 'done' : 'loading')
  useEffect(() => {
    if (instant) return
    if (!total) { setPhase('done'); return }
    let k = 0, t
    const next = () => {
      k++
      setN(k)
      if (k >= total) { setPhase('done'); return }
      t = setTimeout(next, pace)
    }
    t = setTimeout(() => { setPhase('playing'); next() }, reducedMotion() ? 0 : 900)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { n, phase, done: phase === 'done' }
}

// Steps that land one after another once `run` turns on (the awards: tallying, a card, the next card, the button).
// times: ms after `run` for each step. Returns how many have landed.
export function useStaged(run, times, instant = false) {
  const [k, setK] = useState(instant ? times.length : 0)
  useEffect(() => {
    if (!run || instant) return
    const ts = times.map((ms, i) => setTimeout(() => setK(x => Math.max(x, i + 1)), reducedMotion() ? 0 : ms))
    return () => ts.forEach(clearTimeout)
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps
  return k
}

// A bar that fills over `ms` while `active`, then calls onDone (between playoff rounds: basketball's 2.5 s)
export function useTimerBar(active, ms, onDone) {
  const [pct, setPct] = useState(0)
  const done = useRef(onDone); done.current = onDone
  useEffect(() => {
    if (!active) return
    setPct(0)
    const t0 = Date.now()
    const iv = setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / ms) * 100)
      setPct(p)
      if (p >= 100) { clearInterval(iv); done.current?.() }
    }, 40)
    return () => clearInterval(iv)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  return pct
}
export const TimerBar = ({ pct }) => <div className="plf-series-timer"><div className="plf-series-timer-fill" style={{ width: `${pct}%` }} /></div>

// Slowest / Slow / pause / Fast / Skip (basketball's playoff controls; speed is the tick's multiplier)
export function SpeedSeg({ speed, paused, onSpeed, onPause, onSkip, skipLabel = ['Skip', 'Playoff'] }) {
  const b = (v, label) => <button className={`plf-seg-btn${!paused && speed === v ? ' plf-seg-btn--active' : ''}`} onClick={() => onSpeed(v)}>{label}</button>
  return (
    <div className="plf-seg">
      {b(10, 'Slowest')}{b(4, 'Slow')}
      <button className={`plf-seg-btn plf-seg-btn-pause-icon${paused ? ' plf-seg-btn--pause' : ''}`} onClick={onPause} aria-label="Pause">
        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect x="0" y="0" width="3.5" height="12" rx="1" /><rect x="6.5" y="0" width="3.5" height="12" rx="1" /></svg>
      </button>
      {b(1, 'Fast')}
      <button className="plf-seg-btn plf-seg-btn-skip" onClick={onSkip}>{skipLabel[0]}<br />{skipLabel[1]}</button>
    </div>
  )
}

// One playoff game, live: the clock runs from 0 to 1 over 50 ticks (2.5 s at Fast, as basketball's), each event
// lands at its time and moves the score; then the final holds for a beat and onDone moves the series on.
// events: [{ t: 0-1, side: 'me' | 'opp', pts, text }] (in time order; they add up to the final score)
const TICKS = 50
export function useLiveGame({ events, myFinal, oppFinal, speed = 1, paused = false, onDone }) {
  const [phase, setPhase] = useState('pre')
  const [tick, setTick] = useState(0)
  const live = useRef({ tick: 0, ev: 0, my: 0, opp: 0, done: false, iv: null })
  const [score, setScore] = useState({ my: 0, opp: 0, last: null, key: 0 })
  const done = useRef(onDone); done.current = onDone
  const step = useRef(null)
  step.current = () => {
    const L = live.current
    L.tick++
    const t = L.tick / TICKS
    let last = null
    while (L.ev < events.length && events[L.ev].t <= t) {
      const e = events[L.ev++]
      if (e.side === 'me') L.my += e.pts ?? 1; else if (e.side === 'opp') L.opp += e.pts ?? 1
      last = e
    }
    setTick(L.tick)
    if (last) setScore(s => ({ my: L.my, opp: L.opp, last, key: s.key + 1 }))
    if (L.tick >= TICKS && !L.done) {
      L.done = true
      clearInterval(L.iv)
      setScore(s => ({ ...s, my: myFinal, opp: oppFinal }))
      setPhase('post')
      L.doneT = setTimeout(() => done.current?.(), 1260)
    }
  }
  useEffect(() => {
    const L = live.current
    if (phase !== 'live') return
    clearInterval(L.iv)
    if (!paused && !L.done) L.iv = setInterval(() => step.current(), 50 * speed)
    return () => clearInterval(L.iv)
  }, [phase, speed, paused])
  useEffect(() => {
    const t = setTimeout(() => setPhase('live'), 600)
    return () => { clearTimeout(t); clearInterval(live.current.iv); clearTimeout(live.current.doneT) }   // (skipped mid-game: the game never reports in)
  }, [])
  return { phase, t: tick / TICKS, my: score.my, opp: score.opp, last: score.last, key: score.key }
}

// The scoreboard: the away side on the left, the home side on the right (a neutral ground: his side on the left)
// side: { short, name, logo (node), color, seed, score }
export function LiveBoard({ label, away, home, phase, badge, badgeWin, status, progress, post, postWin, postScore, evt = null, className = '' }) {
  const side = (s, right) => (
    <div className={`plf-score-side${right ? ' plf-score-opp' : ''}`}>
      {s.logo}
      <div className="plf-team-abbr" style={{ color: s.color }}>{s.short}</div>
      {s.seed ? <div className="plf-team-seed">{s.seed}</div> : null}
      <div className="plf-score-num" style={{ color: s.color }}><span key={phase === 'post' ? 'f' : s.score} className={phase === 'post' ? '' : 'plf-num-pop'}>{s.score}</span></div>
    </div>
  )
  return (
    <div className={`plf-game${phase === 'post' ? (postWin == null ? ' plf-game-drawn' : postWin ? ' plf-game-won' : ' plf-game-lost') : ''} ${className}`}>
      <div className="plf-round-row"><div className="plf-round-lbl">{label}</div></div>
      <div className="plf-scoreboard">
        {side(away, false)}
        <div className="plf-score-mid">
          <span className="plf-at-sym">{home.neutral ? 'v' : '@'}</span>
          {phase === 'live' ? <div className="plf-live-pill"><span className="plf-live-dot" />LIVE</div>
            : phase === 'post' ? <div className={`plf-result-badge ${badgeWin ? 'plf-rb-win' : 'plf-rb-loss'}`}>{badge}</div> : null}
        </div>
        {side(home, true)}
      </div>
      <div className="plf-live-area" style={{ visibility: phase === 'live' ? 'visible' : 'hidden' }}>
        {status}
        <div className="plf-progress"><div className="plf-progress-fill" style={{ width: `${progress * 100}%` }} /></div>
      </div>
      <div className="sfl-evt" aria-live="polite">{evt}</div>
      <div className={`plf-post-line ${postWin ? 'plf-pl-won' : 'plf-pl-lost'}`} style={{ visibility: phase === 'post' ? 'visible' : 'hidden' }}>
        <span>{post}</span><span className="plf-post-score">{postScore}</span>
      </div>
    </div>
  )
}

// The title, or the end of the road. Champions: tap the bottle, the trophy comes up, then the button
export function ChampCard({ title, sub, trophy, popped, onPop, cta, onNext }) {
  return (
    <div className="plf-end-card plf-end-card--champ">
      {popped ? <div className="plf-trophy-reveal sfl-trophy">{trophy}</div>
        : <button className="plf-champ-bottle" onClick={onPop} aria-label="Pop champagne">🍾</button>}
      <div className="plf-champ-label">{title}</div>
      <div className="plf-champ-sub">{sub}</div>
      {popped ? <button className="simp-cta simp-cta-in plf-report-reveal" onClick={onNext}>{cta}</button> : <div className="plf-champ-tap-hint">tap the bottle</div>}
    </div>
  )
}
export function OverCard({ eyebrow = 'Season Over', title, round, line, cta, onNext, children }) {
  return (
    <div className="plf-end-card">
      <div className="simp-eyebrow">{eyebrow}</div>
      <div className="plf-elim-title">{title}</div>
      {round ? <div className="plf-elim-round">{round}</div> : null}
      {line ? <div className="plf-elim-score">{line}</div> : null}
      {children}
      <button className="simp-cta" onClick={onNext}>{cta}</button>
    </div>
  )
}
export function MissCard({ eyebrow, title, sub, cta = 'See Summary', onNext }) {
  return (
    <div className="simp-screen simp-screen-center sfl-miss">
      <div className="simp-eyebrow">{eyebrow}</div>
      <div className="simp-miss-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="24" cy="24" r="19" /><path d="M16 16l16 16M32 16L16 32" /></svg>
      </div>
      <div className="simp-miss-title">{title}</div>
      {sub && <div className="simp-miss-sub">{sub}</div>}
      <button className="simp-cta" onClick={onNext}>{cta}</button>
    </div>
  )
}

// The wire: the latest headline (it changes as the games come in, never on a loop)
export function WireLine({ items }) {
  const it = items[items.length - 1]
  if (!it) return null
  return <div className="sm-wire"><span className="sm-wire-tag">WIRE</span><span key={it} className="sm-wire-text">{it}</span></div>
}

// The season pulse (basketball's): games over .500, the playoff line, the current point
// (step: what a game adds to the line, a win +1 and a loss -1; soccer's draw 0. need: the line's own level, else the
// pace to `playoffWins`)
export function Pulse({ games, total, playoffWins, step = null, need = null }) {
  const pts = useMemo(() => {
    let d = 0
    return games.map((g, i) => { d += step ? step(g) : g.won ? 1 : -1; return [i + 1, d] })
  }, [games]) // eslint-disable-line react-hooks/exhaustive-deps
  const W = 320, H = 72, pad = 6
  const maxAbs = Math.max(4, ...pts.map(p => Math.abs(p[1])))
  const x = i => pad + (i / total) * (W - pad * 2)
  const y = d => H / 2 - (d / maxAbs) * (H / 2 - pad)
  const path = pts.length ? 'M' + pts.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' L') : ''
  const last = pts[pts.length - 1]
  // the pace needed to reach the playoff line by season's end
  const needD = need ?? playoffWins * 2 - total
  return (
    <svg className="sm-pulse" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} className="sm-pulse-zero" />
      <line x1={pad} x2={W - pad} y1={y(needD)} y2={y(needD)} className="sm-pulse-po" />
      {path && <path d={path} className="sm-pulse-line" />}
      {last && <circle cx={x(last[0])} cy={y(last[1])} r="3.5" className="sm-pulse-dot" />}
    </svg>
  )
}

// The season's moments, on or off (the key lib/seasonDirector.js reads: momentsOff)
const MOMENTS_OFF_KEY = 'bap_moments_off'
export const momentsOn = () => { try { return localStorage.getItem(MOMENTS_OFF_KEY) !== '1' } catch { return true } }
const momentsOff = () => !momentsOn()
const setMomentsOff = off => { try { localStorage.setItem(MOMENTS_OFF_KEY, off ? '1' : '0') } catch {} }
// Moments on / off (the sim page's team card). Off: the season plays straight
// through, no decisions; the milestones and records still fire.
export function MomentsToggle() {
  const [off, setOff] = useState(() => momentsOff())
  // (a moment's own button can turn them off while this is on screen)
  useEffect(() => {
    const sync = () => setOff(momentsOff())
    window.addEventListener('bap:moments-off', sync)
    return () => window.removeEventListener('bap:moments-off', sync)
  }, [])
  return (
    <button className={`sts-moments${off ? ' is-off' : ''}`} onClick={() => { setMomentsOff(!off); setOff(!off); sfx('tap'); window.dispatchEvent(new Event('bap:moments-off')) }} aria-pressed={!off} title={off ? 'Turn the season\'s moments back on' : 'Play the season straight through, no decisions'}>
      <span className="sts-moments-knob" /><span>MOMENTS {off ? 'OFF' : 'ON'}</span>
    </button>
  )
}

// League leaders (basketball's board): the top of a race, his place under it
// rows: [{ name, team, value, me, rank }] (names already labelled: the build is the username)
export function LeadersBoard({ label, rows, rank, who }) {
  return (
    <div className="sm-leaders ag-pop">
      <div className="sm-leaders-head"><span className="ag-eyebrow">LEAGUE LEADERS · {label}</span>{rank ? <span className="sm-leaders-rank">{who}: #{rank}</span> : null}</div>
      {rows.map((r, i) => (
        <div key={i} className={`sm-leader${r.me ? ' is-me' : ''}`}>
          <span className="sm-leader-n">{r.rank ?? i + 1}</span>
          <span className="sm-leader-name">{r.name}<small>{r.team}</small></span>
          <span className="sm-leader-val">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

// The checking beat of the legacy screen (basketball's GOAT Status: "Checking the credentials…")
export function Checking({ label }) {
  return <div className="goat-checking"><div className="goat-check-ring" /><div className="goat-check-lbl">{label}</div></div>
}
