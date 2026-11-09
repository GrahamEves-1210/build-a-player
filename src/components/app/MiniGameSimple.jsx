import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { zoneWidth, powerZone, reactMs, lanesMs, callMs, routes, DRILL_CALLS, LOOKS } from '../../lib/minigames'
import { SIMPLE_GAMES as GAMES, simpleTraitValue as traitValue } from '../../lib/minigamesSimple'
import { valToGrade, dlBuildSpot } from '../../utils/simulation'
import { dashTarget, coneShift } from '../../lib/mg/combineNorms'
import { seeded } from '../../lib/rng'
import { sfx, haptic } from '../../lib/juice'
import { IS_APP } from '../../lib/platform'
import WatchVideo from './WatchVideo'
import { REWARDED_ON } from '../../lib/rewardedAd'
import { IconCaret } from './icons'
import './mg-simple.css'
// (baseball's own, loaded only when one opens: nothing of it in anyone else's games)
const BaseballSimple = lazy(() => import('./MiniGameSimpleBaseball'))

// Career's SIMPLE mini games: the original quick skill games (before the canvas games,
// commit e1255f2), with stand-ins for the moments added since (lib/minigamesSimple.js).
// <MiniGameSimple game build seed onDone /> shows the card, runs the game and reports
// { score, hit, note, raw, out }, the same shape as MiniGame. A test can finish any game through
// window.__bapMini.finish(score). (ADVANCED is MiniGame.jsx; OFF is MiniGame's sim.)
//
// How they feel:
// - a press counts on pointerdown / keydown, judged at the event's own timestamp against the
//   game's clock, so a slow frame or a busy handler never costs a press
// - the press is answered on the same frame: the marker snaps where it was, the zone or the
//   button flashes the result, and a word (PERFECT, GOOD, EARLY, LATE...) shows over the play
// - everything that moves is written straight to the DOM (transform / opacity) from one
//   requestAnimationFrame loop; React only renders on presses
// - the game stays on screen when it ends and the result lands over it a beat later

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const useRng = seed => useMemo(() => seeded(`mg-${seed}`), [seed])
const now = () => performance.now()
// when the press happened, on performance.now()'s clock
const pressAt = e => (e && e.timeStamp > 0 ? Math.min(e.timeStamp, now()) : now())
// a mouse's main button only (a right-click is not a press)
const primary = fn => e => { if (e.button > 0) return; fn(e) }
const tri = t => { const p = ((t % 2) + 2) % 2; return p <= 1 ? p : 2 - p }     // 0→1→0 sweep
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const grade = q => (q >= 0.85 ? 'PERFECT' : 'GOOD')
// Every window a fifth tighter and every sweep quicker than the original games (they played easy).
// (the shared windows in lib/minigames.js stay as they are: the Advanced games read them too)
const HARD = 0.8
const zw = v => zoneWidth(v) * HARD
// A moving marker runs on the compositor: a Web Animation started at an exact moment on
// performance.now()'s clock (the document timeline's), so a press is judged with the same math the
// animation runs on, and a busy main thread can't make it stutter. glide(el, frames, ms, t0, opts)
function glide(el, frames, ms, t0, o = {}) {
  if (!el?.animate) return null
  el.getAnimations?.().forEach(a => a.cancel())
  const a = el.animate(frames, { duration: ms, iterations: o.iterations ?? 1, fill: o.fill ?? 'both', easing: o.easing ?? 'linear' })
  try { a.startTime = t0 } catch {}
  return a
}
const halt = el => el?.getAnimations?.().forEach(a => a.cancel())
// (an exact x² and 1 - (1 - x)² as cubic Béziers: the Advanced meter's curve, run by the browser)
const EASE_IN2 = 'cubic-bezier(.3333,0,.6667,.3333)', EASE_OUT2 = 'cubic-bezier(.3333,.6667,.6667,1)'
// the position the build plays (Fourth & Goal's version, the combine's scale); null in Practice
function posOf(build) {
  if (!build) return null
  if (build.arm || build.accuracy) return 'qb'
  if (build.getOff || build.powerMoves || build.finesseMoves) return dlBuildSpot(build) === 'dt' ? 'dt' : 'edge'
  if (build.blocking) return 'te'
  if (build.zoneIQ || build.runSupport) return 'db'
  if (build.bodyControl || build.release) return 'wr'
  if (build.elusiveness) return 'rb'
  if (build.passPro || build.runBlock) return 'ol'
  if (build.jumpShot || build.handles || build.rebounding) return (build.size?.val ?? 5) >= 7 ? 'big' : 'guard'
  return null
}
const pick1 = (r, l) => l[Math.floor(r() * l.length) % l.length]

// a requestAnimationFrame loop for as long as `on`; fn(ts) returns false to stop
function useLoop(fn, on = true, deps = []) {
  const f = useRef(fn); f.current = fn
  useEffect(() => {
    if (!on) return
    let raf
    const tick = ts => { if (f.current(ts) !== false) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, ...deps]) // eslint-disable-line
}
// desktop keys: map of key → action(e), on keydown (never a held key's repeats); up: on keyup
function useKeys(map, up = null) {
  const m = useRef(map), u = useRef(up); m.current = map; u.current = up
  useEffect(() => {
    const pick = (o, e) => o && (o[e.key] ?? o[e.key.toLowerCase()])
    const dn = e => { const fn = pick(m.current, e); if (!fn) return; e.preventDefault(); if (!e.repeat) fn(e) }
    const upH = e => { const fn = pick(u.current, e); if (fn) { e.preventDefault(); fn(e) } }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', upH)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', upH) }
  }, [])
}
// a game reports once, however many presses land at once
function useOnce(onDone) {
  const ended = useRef(false)
  return [r => { if (ended.current) return; ended.current = true; onDone(r) }, ended]
}
// timers that die with the game
function useTimers() {
  const ts = useRef([])
  useEffect(() => () => ts.current.forEach(clearTimeout), [])
  return (fn, ms) => { const t = setTimeout(fn, ms); ts.current.push(t); return t }
}

// ── The answer to a press ───────────────────────────────────────────────────
// The word over the play (PERFECT, GOOD, LATE...): written and animated directly, no render
const Fx = ({ r }) => <span className="mg-fx" ref={r} aria-live="polite" />
function say(el, text, tone) {
  if (!el) return
  el.textContent = text; el.dataset.tone = tone
  el.getAnimations?.().forEach(a => a.cancel())
  const still = 'translate(-50%,0)'
  el.animate?.(reduced()
    ? [{ opacity: 1, transform: still }, { opacity: 1, transform: still, offset: 0.75 }, { opacity: 0, transform: still }]
    : [{ opacity: 0, transform: 'translate(-50%,5px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: 0.1 }, { opacity: 1, transform: still, offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-3px)' }],
  { duration: 850, easing: 'ease-out', fill: 'forwards' })
}
// a flash over a zone or a button (its .mg-fl child): green made, red missed
function flash(el, tone) {
  const f = el?.querySelector(':scope > .mg-fl'); if (!f) return
  f.dataset.tone = tone
  f.getAnimations?.().forEach(a => a.cancel())
  // (Reduce Motion: a steady tint that fades, no blink)
  f.animate?.(reduced() ? [{ opacity: 0.45 }, { opacity: 0.45, offset: 0.6 }, { opacity: 0 }] : [{ opacity: 0.85 }, { opacity: 0 }], { duration: reduced() ? 700 : 380, easing: 'ease-out' })
}
const Fl = () => <i className="mg-fl" aria-hidden="true" />
const good = perfect => { sfx('tap'); haptic(perfect ? 'medium' : 'light') }
const bad = () => { sfx('pop'); haptic('heavy') }
// the instruction: TAP on a phone, the key on a desktop
const Hint = ({ touch, desk, children, className = '' }) => (
  <span className={`mg-hint ${className}`}>{touch && <><b className="mg-on-touch">{touch}</b><b className="mg-on-desk">{desk}</b> </>}{children}</span>
)
const Kbd = ({ k }) => <kbd className="mg-kbd" aria-hidden="true">{k}</kbd>
const Dots = ({ n, of }) => <span className="mg-dots">{Array.from({ length: n }, (_, k) => <i key={k} className={k < of.length ? (of[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>

// ── A little personality: one short line under the verdict, and the play's own sound ──
// [made lines, missed lines]: one is picked by the seed, so a replay reads the same
const LINES = {
  'hot-read': [['Dime.', 'Read it and let it rip.'], ['Forced it.', 'Held it a beat too long.']],
  'bomb': [['Dropped it in the bucket.', 'Right over the top.'], ['Underthrown.', 'Sailed on him.']],
  'escape': [['Slipped the sack.', 'Out of the pocket, free.'], ['Sacked.', 'Brought down in the pocket.']],
  'sneak': [['Moved the pile.', 'Moves the chains.'], ['Stuffed at the line.', 'No push.']],
  'two-minute': [['Marched them down the field.', 'Ice in the veins.'], ['The drive stalls.', 'Not this time.']],
  'third-long': [['Moves the sticks.', 'Fit it in there.'], ['Off target.', 'Punt team, take the field.']],
  'audible': [['Checked into the right play.', 'Had them at the line.'], ['Wrong check.', 'Burned by the look.']],
  'goal-line': [['Six.', 'Punched it in.'], ['Turned away.', 'Denied at the goal line.']],
  'gap': [['Hit the hole.', 'Daylight.'], ['Met in the hole.', 'Nowhere to go.']],
  'juke': [['Left him grasping.', 'Made him miss.'], ['Wrapped up.', 'He read the cut.']],
  'catch': [['Soft hands.', 'Locked it in.'], ['Off his hands.', 'Put it on the turf.']],
  'juke-wr': [['Made him miss.', 'Turned upfield.'], ['Wrapped up.', 'He read the cut.']],
  'release': [['Off the line clean.', 'Won at the line.'], ['Rerouted.', 'Jammed up at the line.']],
  'seal': [['Edge sealed.', 'Walled him off.'], ['Beat on the edge.', 'Lost the leverage.']],
  'juke-te': [['Broke the tackle.', 'Extra yards.'], ['Wrapped up.', 'Down on contact.']],
  'jump-route': [['Jumped it.', 'Broke on the ball.'], ['Bit on the double move.', 'A step late.']],
  'zone-drop': [['Read the quarterback.', 'Broke on it.'], ['Got looked off.', 'A step late out of the drop.']],
  'tackle-angle': [['Took the right angle.', 'Squared him up.'], ['Bad angle.', 'Ran right past him.']],
  'pass-rush': [['Got home.', 'In the backfield.'], ['Stoned at the line.', 'Stalemate.']],
  'run-stuff': [['Filled it hard.', 'Nothing there.'], ['Out of his gap.', 'Cut back on him.']],
  'iso': [['Blew right by him.', 'Got a step.'], ['Cut off.', 'He stayed in front.']],
  'pnr': [['Found the open man.', 'Right read.'], ['Into the trap.', 'Turned it over.']],
  'clutch-shot': [['Cash.', 'Ice cold.'], ['Off the rim.', 'Front rim.']],
  'free-throws': [['Steady at the line.', 'Nothing but net.'], ['Rimmed out.', 'Left it short.']],
  'post-up': [['Spun right off him.', 'Easy two.'], ['Walled off.', 'Stripped in the post.']],
  'board': [['Ripped it down.', 'Owns the glass.'], ['Boxed out.', 'Lost the board.']],
  'rim-protect': [['Sent it back.', 'Rejected.'], ['Bit on the fake.', 'Late to the rim.']],
  'lockdown': [['Locked him up.', 'Stayed in front.'], ['Blown by.', 'Bit on the hesi.']],
  'fast-break': [['Made the right read.', 'Easy two the other way.'], ['Turned it over.', 'Wrong read on the break.']],
  'alley-oop': [['Threw it down.', 'Hammered it home.'], ['Off the fingertips.', 'Could not finish the lob.']],
  'half-court': [['Got a bucket.', 'Cooked him.'], ['Came up empty.', 'They got the stop.']],
  'pass-pro': [['Kept the pocket clean.', 'Nobody got home.'], ['The pocket caved in.', 'Beat off the edge.']],
  'penalty': [['Sent him the wrong way.', 'Buried it.'], ['Saved.', 'He guessed right.']],
  'one-on-one': [['Kept his cool.', 'Slotted it home.'], ['The keeper won that one.', 'Should have scored.']],
  'header': [['Powered it in.', 'Bullet header.'], ['Couldn’t direct it.', 'Got under it.']],
  'volley': [['Hit it on the half-volley.', 'What a strike.'], ['Skied it.', 'Didn’t catch it right.']],
  'free-kick': [['Over the wall and in.', 'Right in the top corner.'], ['Into the wall.', 'The keeper had it covered.']],
  'two-on-one': [['Made the right choice.', 'Finished the break.'], ['Wrong option.', 'Wasted the two-on-one.']],
}
const reactLine = (game, out, seed) => { const l = LINES[game]; return l ? pick1(seeded(`line-${seed}-${game}`), l[out.hit ? 0 : 1]) : null }
// the play's own sound at the result: [made, missed] (contact, a catch, a make, the rim)
const HIT = ['stamp', 'deny']
const SOUND = {
  'sneak': HIT, 'seal': HIT, 'release': HIT, 'pass-rush': HIT, 'run-stuff': HIT, 'tackle-angle': HIT, 'juke': HIT, 'juke-wr': HIT, 'juke-te': HIT, 'post-up': HIT,
  'catch': ['catchball', 'deny'], 'goal-line': ['stamp', 'deny'], 'jump-route': ['catchball', 'deny'], 'zone-drop': ['catchball', 'deny'],
  'clutch-shot': ['make', 'rimmiss'], 'free-throws': ['make', 'rimmiss'], 'board': ['catchball', 'rimmiss'], 'rim-protect': ['stamp', 'make'],
  'lockdown': HIT, 'fast-break': ['make', 'deny'], 'alley-oop': ['make', 'rimmiss'], 'half-court': ['make', 'rimmiss'], 'pass-pro': HIT,
  'penalty': HIT, 'one-on-one': HIT, 'header': HIT, 'volley': HIT, 'free-kick': HIT, 'two-on-one': HIT,
}

// retry (Career, app): a miss can be played again for a video, once
// onSkipAll (Career): the intro's TURN OFF KEY MOMENTS, as on the Advanced card
// pos (optional): the position the build plays, where the build alone can't say (Practice's
// Fourth & Goal rows); without it, Fourth & Goal in Practice asks which side of the ball first
export default function MiniGameSimple({ game, build, seed = 'x', onDone, autoStart = false, hard = false, retry = false, redo = false, lock = null, onSkipAll = null, labV = null, pos = null }) {
  const def = GAMES[game]
  const [stage, setStage] = useState(autoStart ? 'play' : 'intro')
  const [result, setResult] = useState(null)
  const [tries, setTries] = useState(0)          // replays bought with a video (one at most)
  const sent = useRef(false)
  // redo (the combine): one more run of any result, free, and the better of the two counts
  const [first, setFirst] = useState(null)
  const offerRedo = redo && !first && labV == null
  const offerRetry = REWARDED_ON && retry && IS_APP && tries === 0 && !redo
  // hard (training camp): played as if the trait were a notch or two lower (70%), so a
  // maxed build still has to earn it. The header shows the real grade, never the handicap.
  // (Practice picks the grade: labV)
  const real = labV ?? traitValue(game, build)
  // a mercy rule: each miss in a row at this game plays the next one about 3/4 of a grade
  // easier (two at most); a make resets it. The header still shows the real grade.
  const missKey = `bap_mg_miss_${game}`
  const [ease] = useState(() => { if (labV != null) return 0; try { return Math.min(2, Number(localStorage.getItem(missKey)) || 0) } catch { return 0 } })
  const v = Math.min(11, (hard ? Math.max(1, real * 0.7) : real) + ease * 0.75)
  const timers = useTimers()
  const [stat, setStat] = useState(null)          // a combine drill's measured number, for the board
  const [line, setLine] = useState(null)          // the one-line reaction under the verdict
  const done = r => {
    if (sent.current) return
    sent.current = true
    const perfect = !!r.raw && r.raw.of > 0 && r.raw.made === r.raw.of
    // the game's own call decides (camp is already tougher through the handicap above; a
    // separate 0.75 bar there failed drills the game had shown as made)
    const out = { score: clamp(r.score, 0, 1), hit: perfect || (r.hit ?? r.score >= 0.5), note: r.note ?? null, raw: r.raw ?? null, out: !!r.out }
    try { if (out.hit) localStorage.removeItem(missKey); else localStorage.setItem(missKey, String(Math.min(2, ease + 1))) } catch {}
    setStat(r.stat ?? null)
    setLine(reactLine(game, out, `${seed}-${tries}`))
    setResult(out); setStage('done')
    // the last press's own answer first, then the result lands over the frozen play: a measured
    // drill's number goes up at once, with the board's ka-chunk
    const snd = r.stat ? 'lock' : (out.hit ? SOUND[game]?.[0] : SOUND[game]?.[1]) ?? (out.hit ? 'claim' : 'deny')
    timers(() => { sfx(snd); if (r.stat && out.hit) timers(() => sfx('claim'), 260); haptic(out.hit ? 'success' : 'heavy') }, r.stat ? 120 : 300)
    // the redo's in: the better run counts (its number stays up to read, then on)
    if (first) { const best = out.score >= first.score ? out : first; timers(() => { unlock(); onDone?.(best) }, r.stat ? 2300 : 1250); return }
    // one redo on offer, or a miss that can still be replayed: the player's call
    if (offerRedo) return
    if (!out.hit && offerRetry) return
    // (a measured number stays up long enough to read it)
    timers(() => { unlock(); onDone?.(out) }, r.stat ? 2300 : 1250)
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
  // (the traits this player has: the 40 names a QB's Legs, a lineman's Get Off)
  const owned = build ? def.traits.filter(t => build[t]) : []
  const traitNames = (owned.length ? owned : def.traits).slice(0, 2).map(t => t.replace(/([A-Z])/g, ' $1').replace('-', ' ')).join(' · ').toUpperCase()
  return (
    <div className={`mg mg--simple mg--${def.kind}${result ? (result.hit ? ' is-hit' : ' is-miss') : ''}`}>
      <div className="mg-head"><span className="ag-eyebrow">{def.title}</span><span className="mg-trait">{traitNames} · {valToGrade(real)}{hard && <i className="mg-hard">CAMP · TOUGHER</i>}</span></div>
      {stage === 'intro' && (
        <div className="mg-intro">
          <p>{def.how}</p>
          <button className="ag-btn ag-btn--gold" onClick={() => { setStage('play'); sfx('whistle') }}>READY</button>
          {onSkipAll && <button className="ag-btn ag-btn--ghost mg-skipall" onClick={() => { sfx('tap'); onSkipAll() }}>TURN OFF KEY MOMENTS</button>}
        </div>
      )}
      {stage !== 'intro' && (
        <div className={`mg-body${result ? ' is-over' : ''}`}>
          <Game key={tries} def={def} v={v} seed={tries ? `${seed}-again` : seed} build={build} pos={pos} onDone={done} />
          {result && (stat ? (
            <div className="mg-result mg-result--stat" role="status">
              <span className="mg-official">OFFICIAL · {stat.label}</span>
              <span className="mg-stat"><b>{stat.value}</b><i>{stat.unit}</i></span>
              <span className={`mg-verdict${result.hit ? ' is-hit' : ' is-miss'}`}>{stat.verdict ?? (result.hit ? 'GOOD' : 'BELOW THE MARK')}</span>
              {(stat.sub ?? result.note) && <small>{stat.sub ?? result.note}</small>}
            </div>
          ) : (
            <div className="mg-result" role="status">
              <b>{result.hit ? (result.score >= 0.85 ? 'ELITE' : 'GOOD') : result.out ? 'OUT OF TIME' : 'NO GOOD'}</b>
              {line && <span className="mg-react">{line}</span>}
              {result.note && <small>{result.note}</small>}
            </div>
          ))}
        </div>
      )}
      {result && offerRedo && (
        <div className="mg-retry">
          <button className="ag-btn ag-btn--gold" onClick={() => { sent.current = false; setFirst(result); setTries(1); setResult(null); setStat(null); setLine(null); setStage('play') }}>REDO · BETTER RUN COUNTS</button>
          <button className="ag-btn ag-btn--ghost" onClick={() => { unlock(); onDone?.(result) }}>KEEP IT</button>
        </div>
      )}
      {result && !result.hit && offerRetry && (
        <div className="mg-retry">
          <WatchVideo label="WATCH VIDEO · TRY AGAIN" sub="A short video ad, then one more shot at it. Once." onReward={() => { sent.current = false; setTries(1); setResult(null); setStage('play') }} />
          <button className="ag-btn ag-btn--ghost" onClick={() => onDone?.(result)}>TAKE THE RESULT</button>
        </div>
      )}
    </div>
  )
}

function Game({ def, v, seed, build, pos, onDone }) {
  const at = pos ?? posOf(build)
  switch (def.kind) {
    case 'timing': return <Timing v={v} seed={seed} onDone={onDone} />
    case 'sneak': return <Sneak v={v} seed={seed} onDone={onDone} />
    case 'drive': return <Drive v={v} seed={seed} onDone={onDone} />
    case 'taps': return <Taps v={v} seed={seed} n={def.n ?? 3} onDone={onDone} />
    case 'power': return <Power v={v} onDone={onDone} />
    case 'reaction': return <Reaction v={v} seed={seed} rounds={def.rounds ?? 2} quick={def.quick ?? 1} onDone={onDone} />
    case 'audible': return <Audible v={v} seed={seed} onDone={onDone} />
    case 'lanes': return <Lanes v={v} seed={seed} onDone={onDone} need={def.need ?? 2} cue={def.cue} />
    case 'sequence': return <Sequence v={v} seed={seed} onDone={onDone} />
    case 'route': return <Route v={v} seed={seed} onDone={onDone} />
    case 'choice': return <Choice def={def} build={build} seed={seed} onDone={onDone} />
    case 'goalline': return <GoalLine v={v} seed={seed} pos={at} onDone={onDone} />
    case 'press': return <Press v={v} seed={seed} onDone={onDone} />
    case 'seal': return <Seal v={v} seed={seed} onDone={onDone} />
    case 'rush': return <Rush v={v} seed={seed} onDone={onDone} />
    case 'stuff': return <Stuff v={v} seed={seed} onDone={onDone} />
    case 'lockdown': return <Lockdown v={v} seed={seed} onDone={onDone} />
    case 'break': return <FastBreak v={v} seed={seed} onDone={onDone} />
    case 'oop': return <Oop v={v} seed={seed} onDone={onDone} />
    case 'bucket': return <Bucket v={v} seed={seed} onDone={onDone} />
    case 'pro': return <Pro v={v} seed={seed} onDone={onDone} />
    // soccer
    case 'pen': return <Pen v={v} seed={seed} onDone={onDone} />
    case 'oneone': return <OneOne v={v} seed={seed} onDone={onDone} />
    case 'head': return <Head v={v} seed={seed} onDone={onDone} />
    case 'vol': return <Vol v={v} seed={seed} onDone={onDone} />
    case 'slalom': return <Slalom v={v} seed={seed} onDone={onDone} />
    case 'goalaim': return <GoalAim v={v} seed={seed} onDone={onDone} />
    case 'fk': return <FreeKickS v={v} seed={seed} onDone={onDone} />
    case 'twoone': return <TwoOneS v={v} seed={seed} onDone={onDone} />
    case 'touch': return <TouchS v={v} seed={seed} onDone={onDone} />
    // baseball
    case 'bbat': case 'bev': case 'bsteal': case 'bpitch': case 'bgun': case 'bcmd': return <Suspense fallback={null}><BaseballSimple def={def} v={v} seed={seed} onDone={onDone} pos={pos} /></Suspense>
    // the combine
    case 'dash': return <Dash v={v} seed={seed} onDone={onDone} unit={def.unit} dist={def.dist} game={def.drill} pos={at} label={def.stat} />
    case 'velo': return <Velo v={v} seed={seed} onDone={onDone} noun={def.noun} />
    case 'aim': return <Aim v={v} seed={seed} onDone={onDone} noun={def.noun} />
    case 'routes': return <Routes v={v} seed={seed} onDone={onDone} />
    case 'cone': return <Cone v={v} seed={seed} onDone={onDone} lane={def.drill === 'lane'} pos={at} />
    case 'gauntlet': return <Gauntlet v={v} seed={seed} onDone={onDone} />
    case 'bench': return <Bench v={v} load={def.load ?? 1} onDone={onDone} />
    default: return null
  }
}

// ── Timing: a marker sweeps, tap inside the zone ─────────────────────────────
// (the brighter middle third of the zone is PERFECT: the same line as ELITE)
function Bar({ markRef, zoneRef, fx, zone, width, label }) {
  return (
    <div className="mg-box">
      <Fx r={fx} />
      <div className="mg-bar" aria-hidden="true">
        <span className="mg-zone" ref={zoneRef} style={{ left: `${zone - width / 2}%`, width: `${width}%` }}><i className="mg-zone-mid" /><Fl /></span>
        <span className="mg-track" ref={markRef}><span className="mg-marker" /></span>
        {label && <i className="mg-bar-label">{label}</i>}
      </div>
    </div>
  )
}
// Sweeps the marker at one steady speed, end to end and back: a linear Web Animation on its
// transform, so it glides on the compositor with no script in the frame. (It used to be written
// from a requestAnimationFrame loop with a surge on top: on a busy machine the frames came
// unevenly and the surge made the speed jerk, which read as a stutter and a flicker.)
// at(ts) is where it was (0–1) at any moment, from the same start time and the same math, so a
// press is judged exactly where the marker was when it happened; stop() freezes it there.
// Variety comes from the speed (each rep its own), never from the marker changing pace mid-sweep.
const SWEEP = [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(100%,0,0)' }, { transform: 'translate3d(0,0,0)' }]
const SWEEP_Y = [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }]
function useSweep(markRef, speed = 1.15) {
  const c = useRef({ t0: now(), anim: null })
  const at = ts => tri(Math.max(0, (ts - c.current.t0) / 1000) * speed)
  useEffect(() => {
    const t0 = now(), el = markRef.current
    c.current = { t0, anim: null }
    if (el) { el.style.transform = ''; c.current.anim = glide(el, SWEEP, 2000 / speed, t0, { iterations: Infinity }) }
    return () => c.current.anim?.cancel()
  }, [speed]) // eslint-disable-line
  const dir = ts => Math.sign(at(ts + 5) - at(Math.max(c.current.t0, ts - 5))) || 1
  // freeze on the press: the marker snaps to where it was at that moment
  const stop = p => { c.current.anim?.cancel(); if (markRef.current) markRef.current.style.transform = `translate3d(${p.toFixed(2)}%,0,0)` }
  return { at, dir, stop }
}
// a press on the bar: in the zone, or early / late in the marker's direction of travel
function judgeBar(p, zone, width, dir) {
  const d = Math.abs(p - zone), hit = d <= width / 2
  const q = hit ? clamp(1 - d / width, 0.5, 1) : 0
  const early = dir > 0 ? p < zone : p > zone
  return { hit, q, word: hit ? grade(q) : early ? 'EARLY' : 'LATE', note: hit ? null : `${d < width ? 'A touch' : 'Way'} ${early ? 'early' : 'late'}.` }
}
function Timing({ v, seed, onDone, mult = 1, value = 1, label = null }) {
  const r = useRng(seed)
  const zone = useMemo(() => 30 + r() * 40, [r])
  const speed = useMemo(() => 1.58 + r() * 0.22, [r])
  const width = zw(v) * mult
  const mark = useRef(null), zoneEl = useRef(null), fx = useRef(null)
  const [end, ended] = useOnce(onDone)
  const { at, dir, stop } = useSweep(mark, speed)
  const tap = e => {
    if (ended.current) return
    const ts = pressAt(e), p = at(ts) * 100, j = judgeBar(p, zone, width, dir(ts))
    stop(p); flash(zoneEl.current, j.hit ? 'hit' : 'miss'); say(fx.current, j.word, j.hit ? 'hit' : 'miss')
    j.hit ? good(j.q >= 0.85) : bad()
    end({ score: j.hit ? value * j.q : 0, hit: j.hit, note: j.note })
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play" onPointerDown={primary(tap)}>
      <Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={zone} width={width} label={label} />
      <Hint touch="TAP" desk="SPACE">IN THE ZONE</Hint>
    </div>
  )
}
// ── Taps: timing, n in a row ────────────────────────────────────────────────
function Taps({ v, seed, n, onDone }) {
  const [i, setI] = useState(0)
  const [scores, setScores] = useState([])
  const r = useRng(seed)
  const zones = useMemo(() => Array.from({ length: n }, () => 25 + r() * 50), [r, n])
  const width = zw(v)
  const mark = useRef(null), zoneEl = useRef(null), fx = useRef(null), busy = useRef(false)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  // each one quicker (nerves): the pressure is the pace, and the pace never changes mid-sweep
  const { at, dir, stop } = useSweep(mark, 1.66 + i * 0.3)
  const tap = e => {
    if (busy.current || ended.current) return
    const ts = pressAt(e), p = at(ts) * 100, j = judgeBar(p, zones[i], width, dir(ts))
    stop(p); flash(zoneEl.current, j.hit ? 'hit' : 'miss'); say(fx.current, j.word, j.hit ? 'hit' : 'miss')
    j.hit ? good(j.q >= 0.85) : bad()
    const next = [...scores, j.hit ? j.q : 0]
    setScores(next)
    if (i + 1 >= n) { const made = next.filter(Boolean).length; end({ score: next.reduce((a, b) => a + b, 0) / n, hit: made >= Math.ceil(n * 0.67), note: `${made} of ${n}` }) }
    else { busy.current = true; later(() => { busy.current = false; setI(i + 1) }, 420) }   // a beat to see it, then the next
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play" onPointerDown={primary(tap)}>
      <Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={zones[i]} width={width} />
      <Hint touch="TAP" desk="SPACE">IN THE ZONE · {i + 1} OF {n}</Hint>
      <Dots n={n} of={scores} />
    </div>
  )
}
// ── Hold and release (Power, Velo) ──────────────────────────────────────────
// press: the fill climbs (and falls back past the top) from the moment of the press; release:
// judged at the release's own moment. The pointer is captured, so a finger drifting off the meter
// doesn't let go for you; Space works the same way on a desktop.
function useHold({ rate, onUp, ready = () => true }) {
  const fill = useRef(null)
  const H = useRef({ held: false, t0: 0, rate: 1, id: null })
  const [held, setHeld] = useState(false)
  const level = ts => tri(Math.max(0, ts - H.current.t0) / 1000 * H.current.rate) * 100
  const rising = ts => (Math.max(0, ts - H.current.t0) / 1000 * H.current.rate) % 2 < 1
  const down = e => {
    const h = H.current
    if (h.held || !ready()) return
    if (e?.pointerId != null) { h.id = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId) } catch {} } else h.id = null
    h.held = true; h.t0 = pressAt(e); h.rate = rate(); setHeld(true); haptic('light')
    // (the fill climbs and falls back on the compositor, from the press's own moment)
    if (fill.current) { fill.current.style.transform = ''; glide(fill.current, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], 2000 / h.rate, h.t0, { iterations: Infinity }) }
  }
  const up = e => {
    const h = H.current
    if (!h.held || (e?.pointerId != null && h.id != null && e.pointerId !== h.id)) return
    h.held = false; setHeld(false)
    const ts = pressAt(e), L = level(ts)
    halt(fill.current)
    if (fill.current) fill.current.style.transform = `scaleY(${L / 100})`
    onUp(L, rising(ts))
  }
  useEffect(() => () => halt(fill.current), [])
  const area = { onPointerDown: primary(down), onPointerUp: up, onPointerCancel: up, onContextMenu: e => e.preventDefault() }
  return { fill, held, down, up, area }
}
function Power({ v, onDone }) {
  const zone = powerZone(v) * HARD
  const zoneEl = useRef(null), fx = useRef(null)
  const [end, ended] = useOnce(onDone)
  const { fill, held, down, up, area } = useHold({
    rate: () => 1.06, ready: () => !ended.current,
    onUp: (L, rising) => {
      const hit = L >= 100 - zone
      const q = hit ? 0.5 + (L - (100 - zone)) / zone * 0.5 : 0
      flash(zoneEl.current, hit ? 'hit' : 'miss'); say(fx.current, hit ? grade(q) : rising ? 'EARLY' : 'TOO LONG', hit ? 'hit' : 'miss')
      hit ? good(q >= 0.85) : bad()
      end({ score: hit ? q : L / 100 * 0.4, hit, note: hit ? `${Math.round(L)}% power` : rising ? (L >= 100 - zone - 15 ? 'A touch early.' : 'Let go too early.') : 'Held it too long: it dropped.' })
    },
  })
  useKeys({ ' ': down }, { ' ': up })
  return (
    <div className="mg-play mg-play--power" {...area}>
      <div className="mg-box mg-box--meter">
        <Fx r={fx} />
        <div className="mg-meter"><span className="mg-meter-zone" ref={zoneEl} style={{ height: `${zone}%` }}><Fl /></span><span className="mg-meter-fill" ref={fill} /></div>
      </div>
      {held ? <Hint>LET GO NEAR THE TOP</Hint> : <Hint touch="HOLD" desk="HOLD SPACE">TO LOAD</Hint>}
    </div>
  )
}
// ── Reaction: three targets, one opens ──────────────────────────────────────
// A red decoy (covered, the help is there) baits the tap: it flashes during the
// wait, or opens beside the green one. Tapping red is a miss. Every attempt has
// at least one, never on the first rep; it wears an X so it isn't colour alone.
const WORD = { 'Took the bait: red is covered.': 'COVERED', 'Jumped early.': 'EARLY', 'Wrong read.': 'WRONG READ', 'Window closed.': 'TOO SLOW' }
const REACT_FLOOR = 220
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
  const [scores, setScores] = useState([])
  // the round's live state in refs, so a press is judged by what was on screen at its moment
  const R = useRef({ open: null, at: 0, decoy: null, done: false })
  const outs = useRef(0), baited = useRef(false), btns = useRef([]), fx = useRef(null)
  const [end] = useOnce(onDone)
  const T = reactMs(v) * quick * 0.84   // (some drills give less time; all of them a sixth less than they did)
  useEffect(() => {
    setOpen(null); setDecoy(null)
    R.current = { open: null, at: 0, decoy: null, done: false }
    const { delay, open: o, decoy: d } = plan[i]
    const ts = [
      setTimeout(() => { R.current.open = o; R.current.at = now(); setOpen(o) }, delay),
      setTimeout(() => { outs.current++; settle(0, 'Window closed.') }, delay + T + 60),
    ]
    // (the early flash looks like the real one: watch, don't guess)
    if (d) ts.push(setTimeout(() => { R.current.decoy = d.k; setDecoy(d.k) }, d.at))
    if (d?.early) ts.push(setTimeout(() => { R.current.decoy = null; setDecoy(null) }, d.at + 420))
    return () => ts.forEach(clearTimeout)
  }, [i]) // eslint-disable-line
  const settle = (s, note, k = null) => {
    if (R.current.done) return
    R.current.done = true
    if (k != null) flash(btns.current[k], s ? 'hit' : 'miss')
    say(fx.current, s ? grade(s) : WORD[note] ?? 'MISSED', s ? 'hit' : 'miss')
    s ? good(s >= 0.85) : bad()
    const next = [...scores, s]
    setScores(next)
    // one slip allowed; two and the read is lost (every miss the clock: it says so)
    if (i + 1 >= rounds) {
      const avg = next.reduce((a, b) => a + b, 0) / rounds, made = next.filter(Boolean).length
      const hit = made >= rounds - 1
      end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: hit ? `${made} of ${rounds} reads` : baited.current ? `${made} of ${rounds} · bit on the red` : note, out: outs.current > 0 && outs.current >= next.filter(x => !x).length, raw: { made, of: rounds } })
    }
    else setI(i + 1)
  }
  const tap = (k, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (k === S.decoy) { baited.current = true; settle(0, 'Took the bait: red is covered.', k); return }
    if (S.open == null || ts < S.at) { settle(0, 'Jumped early.', k); return }
    if (k !== S.open) { settle(0, 'Wrong read.', k); return }
    // a person needs ~220 ms to see green and move: that much is free
    settle(clamp(1 - Math.max(0, ts - S.at - REACT_FLOOR) / (T - REACT_FLOOR), 0.35, 1), null, k)
  }
  useKeys({ 1: e => tap(0, e), 2: e => tap(1, e), 3: e => tap(2, e), ArrowLeft: e => tap(0, e), ArrowUp: e => tap(1, e), ArrowDown: e => tap(1, e), ArrowRight: e => tap(2, e) })
  return (
    <div className="mg-play mg-play--targets">
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-targets">{[0, 1, 2].map(k => <button key={k} ref={el => { btns.current[k] = el }} className={`mg-target${open === k ? ' is-open' : decoy === k ? ' is-decoy' : ''}`} onPointerDown={e => tap(k, e)} aria-label={`Target ${k + 1}`}><span /><Kbd k={k + 1} /><Fl /></button>)}</div>
      </div>
      <Hint>{open == null ? 'WAIT FOR GREEN' : 'NOW'}</Hint>
      <Dots n={rounds} of={scores} />
    </div>
  )
}
// ── A shrinking clock bar ───────────────────────────────────────────────────
// (a CSS animation drains it on the compositor; a timer calls time). ctl.current.stop() freezes it
function Clock({ ms, onOut, ctl }) {
  const out = useRef(onOut); out.current = onOut
  const bar = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => out.current(), ms)
    if (ctl) ctl.current = { stop: () => { clearTimeout(t); if (bar.current) bar.current.style.animationPlayState = 'paused' } }
    return () => clearTimeout(t)
  }, [ms]) // eslint-disable-line
  return <div className="mg-clock"><span ref={bar} style={{ animation: `mg-drain ${ms}ms linear forwards`, "--mg-ms": `${ms}ms` }} /></div>
}
// three calls on buttons (keys 1–3): the pick flashes, and a wrong one shows the right one
function Calls({ items, onPick, btns, sub = null }) {
  return (
    <div className="mg-calls">{items.map((a, k) => (
      <button key={k} ref={el => { btns.current[k] = el }} className="mg-call" onPointerDown={e => onPick(k, e)}>
        <Kbd k={k + 1} /><span className="mg-call-txt">{a}{sub?.[k] && <small>{sub[k]}</small>}</span><Fl />
      </button>
    ))}</div>
  )
}
const showCall = (btns, k, right, ok) => { flash(btns.current[k], ok ? 'hit' : 'miss'); if (!ok && right != null) flash(btns.current[right], 'hit') }
function Audible({ v, seed, onDone }) {
  const r = useRng(seed)
  const look = useMemo(() => LOOKS[Math.floor(r() * LOOKS.length)], [r])
  const T = callMs(v) * 0.85 + 450
  const t0 = useRef(now()), btns = useRef([]), fx = useRef(null), clock = useRef(null)
  const [end, ended] = useOnce(onDone)
  const pick = (k, e) => {
    if (ended.current) return
    const ok = k === look.c
    clock.current?.stop(); showCall(btns, k, look.c, ok); say(fx.current, ok ? 'RIGHT CALL' : 'WRONG CALL', ok ? 'hit' : 'miss')
    ok ? good(false) : bad()
    end({ score: ok ? clamp(1 - (pressAt(e) - t0.current) / T * 0.5, 0.5, 1) : 0, hit: ok, note: look.why })
  }
  useKeys({ 1: e => pick(0, e), 2: e => pick(1, e), 3: e => pick(2, e) })
  return (
    <div className="mg-play mg-play--calls">
      <Clock ms={T} ctl={clock} onOut={() => { if (ended.current) return; say(fx.current, 'DELAY OF GAME', 'miss'); bad(); end({ score: 0, hit: false, note: 'Delay of game.', out: true }) }} />
      <div className="mg-box mg-box--look"><Fx r={fx} /><span className="mg-look-eyebrow">THE DEFENSE SHOWS</span><span className="mg-look mg-look--big">{look.s}</span></div>
      <Calls items={look.a} onPick={pick} btns={btns} />
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
  const R = useRef({ from: null, at: 0, done: false })
  const outs = useRef(0), btns = useRef({}), fx = useRef(null)
  const [end] = useOnce(onDone)
  const T = lanesMs(v) * 0.84
  useEffect(() => {
    setFrom(null); R.current = { from: null, at: 0, done: false }
    const t1 = setTimeout(() => { R.current.from = plan[i].from; R.current.at = now(); setFrom(plan[i].from) }, plan[i].delay)
    const t2 = setTimeout(() => { outs.current++; settle(0, 'TOO SLOW') }, plan[i].delay + T + 60)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = (s, word, side = null) => {
    if (R.current.done) return
    R.current.done = true
    if (side) flash(btns.current[side], s ? 'hit' : 'miss')
    say(fx.current, s ? grade(s) : word, s ? 'hit' : 'miss')
    s ? good(s >= 0.85) : bad()
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= 3) { const avg = next.reduce((a, b) => a + b, 0) / 3; const made = next.filter(Boolean).length; end({ score: made >= need ? avg : Math.min(avg, 0.45), hit: made >= need, note: `${made} of 3`, out: outs.current > 0 && outs.current >= 3 - made, raw: { made, of: 3 } }) }
    else setI(i + 1)
  }
  const go = (side, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (S.from == null || ts < S.at) { settle(0, 'EARLY', side); return }
    if (S.from === side) { settle(0, 'WRONG WAY', side); return }
    settle(clamp(1 - Math.max(0, ts - S.at - REACT_FLOOR) / (T - REACT_FLOOR), 0.4, 1), null, side)   // (the first ~220 ms free, as Reaction)
  }
  useKeys({ ArrowLeft: e => go('L', e), ArrowRight: e => go('R', e), a: e => go('L', e), d: e => go('R', e) })
  return (
    <div className="mg-play mg-play--lanes">
      <div className="mg-box">
        <Fx r={fx} />
        <div className={`mg-rush${from ? ` is-${from}` : ''}`}><i>{from === 'L' ? <><IconCaret dir="left" size={14} /> {cue}</> : from === 'R' ? <>{cue} <IconCaret dir="right" size={14} /></> : 'WAIT'}</i></div>
      </div>
      <div className="mg-sides">
        <button className="mg-side" ref={el => { btns.current.L = el }} onPointerDown={e => go('L', e)}><IconCaret dir="left" size={14} /> LEFT<Fl /></button>
        <button className="mg-side" ref={el => { btns.current.R = el }} onPointerDown={e => go('R', e)}>RIGHT <IconCaret dir="right" size={14} /><Fl /></button>
      </div>
      <Hint>GO AWAY FROM THE {cue}</Hint>
      <Dots n={3} of={scores} />
    </div>
  )
}
// ── Sequence: the two-minute drill ──────────────────────────────────────────
function Sequence({ v, seed, onDone }) {
  const r = useRng(seed)
  const calls = useMemo(() => [...DRILL_CALLS].sort(() => r() - .5).slice(0, 4), [r])
  const [i, setI] = useState(0)
  const [marks, setMarks] = useState([])
  const T = callMs(v) * 0.85
  const outs = useRef(0), busy = useRef(false), btns = useRef([]), fx = useRef(null), clock = useRef(null)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  const c = calls[i]
  const step = (k, late = false) => {
    if (busy.current || ended.current) return
    const ok = !late && k === c.c
    if (late) outs.current++
    clock.current?.stop()
    if (k != null) showCall(btns, k, c.c, ok)
    say(fx.current, late ? 'TOO SLOW' : ok ? 'RIGHT CALL' : 'WRONG CALL', ok ? 'hit' : 'miss')
    ok ? good(false) : bad()
    const next = [...marks, ok ? 1 : 0], n = next.filter(Boolean).length
    setMarks(next)
    if (i + 1 >= calls.length) end({ score: n / calls.length, hit: n >= 3, note: `${n} of ${calls.length} right`, out: outs.current > 0 && outs.current >= calls.length - n, raw: { made: n, of: calls.length } })
    else { busy.current = true; later(() => { busy.current = false; setI(i + 1) }, 450) }
  }
  useKeys({ 1: () => step(0), 2: () => step(1), 3: () => step(2) })
  return (
    <div className="mg-play mg-play--calls">
      <Clock key={i} ms={T} ctl={clock} onOut={() => step(null, true)} />
      <div className="mg-box"><Fx r={fx} /><span className="mg-look">{c.s}</span></div>
      <Calls key={`c${i}`} items={c.a} onPick={k => step(k)} btns={btns} />
      <Hint>CALL {i + 1} OF {calls.length}</Hint>
      <Dots n={calls.length} of={marks} />
    </div>
  )
}
// ── Route: pick it, then hit its window ─────────────────────────────────────
function Route({ v, seed, onDone }) {
  const [route, setRoute] = useState(null)
  const btns = useRef([])
  const list = routes(v)
  const pick = k => { if (route) return; const [id, label, mult, val] = list[k]; sfx('tap'); setRoute({ id, label, mult, val }) }
  useKeys({ 1: () => pick(0), 2: () => pick(1), 3: () => pick(2) })
  if (!route) return (
    <div className="mg-play mg-play--calls">
      <div className="mg-box"><span className="mg-look">3RD & 9 · PICK THE ROUTE</span></div>
      <Calls items={list.map(x => x[1])} sub={list.map(([id]) => (id === 'slant' ? 'Easy · a first down' : id === 'dig' ? 'Medium · a chunk play' : 'Hard · a touchdown'))} onPick={pick} btns={btns} />
    </div>
  )
  return <Timing v={v} seed={`${seed}-${route.id}`} mult={route.mult} value={route.val} label={route.label} onDone={onDone} />
}
// ── Choice: two ways to play it ─────────────────────────────────────────────
function Choice({ def, build, seed, onDone }) {
  const [pick, setPick] = useState(null)
  const btns = useRef([])
  const choose = k => { if (pick || !def.options[k]) return; const [id, , kind, traits] = def.options[k]; sfx('tap'); setPick({ id, kind, v: traitValue(null, build, traits) }) }
  useKeys({ 1: () => choose(0), 2: () => choose(1), 3: () => choose(2) })
  if (!pick) return (
    <div className="mg-play mg-play--calls">
      <div className="mg-box"><span className="mg-look">{def.title}</span></div>
      <Calls items={def.options.map(o => o[1])} sub={def.options.map(o => o[3].join(' · '))} onPick={choose} btns={btns} />
    </div>
  )
  return pick.kind === 'timing' ? <Timing v={pick.v} seed={`${seed}-${pick.id}`} onDone={onDone} /> : <Lanes v={pick.v} seed={`${seed}-${pick.id}`} onDone={onDone} />
}

// ═══ The moments with their own games ══════════════════════════════════════
// a bar the play ends on (Fourth & Goal's throw and catch): one press, judged where the marker was
function BeatBar({ seed, width, speed, label, fx, onPress, hint = 'TO THROW' }) {
  const r = useRng(seed)
  const zone = useMemo(() => 30 + r() * 40, [r])
  const mark = useRef(null), zoneEl = useRef(null), sent = useRef(false)
  const { at, dir, stop } = useSweep(mark, speed)
  const tap = e => {
    if (sent.current) return
    sent.current = true
    const ts = pressAt(e), p = at(ts) * 100, j = judgeBar(p, zone, width, dir(ts))
    stop(p); flash(zoneEl.current, j.hit ? 'hit' : 'miss')
    onPress(j)
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-drive-throw" onPointerDown={primary(tap)}>
      <Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={zone} width={width} label={label} />
      <Hint touch="TAP" desk="SPACE">{hint}</Hint>
    </div>
  )
}

// ── Fourth & Goal: a two-beat play ──────────────────────────────────────────
// QB: read the coverage (one receiver comes open: pick him before the pocket goes), then the throw.
// RB / WR / TE: win off the line (the defender leans one way: go the other), then the catch.
// The first beat sets the second: a quick read or a clean release is a bigger window.
const GOAL_ROLES = [['qb', 'QB', 'Read the coverage, then the throw'], ['rb', 'RB', 'Beat the linebacker, then the catch'], ['wr', 'WR', 'Beat the jam, then the catch'], ['te', 'TE', 'Beat the jam, then the catch']]
function GoalLine({ v, seed, pos, onDone }) {
  const known = GOAL_ROLES.some(([id]) => id === pos) ? pos : null
  const [as, setAs] = useState(known)
  const btns = useRef([])
  // (Practice has no build to say who's playing it: it asks)
  const choose = k => { if (as || !GOAL_ROLES[k]) return; sfx('tap'); setAs(GOAL_ROLES[k][0]) }
  useKeys({ 1: () => choose(0), 2: () => choose(1), 3: () => choose(2), 4: () => choose(3) })
  if (!as) return (
    <div className="mg-play mg-play--calls">
      <div className="mg-box"><span className="mg-look">4TH & GOAL · WHO HAS IT</span></div>
      <Calls items={GOAL_ROLES.map(x => x[1])} sub={GOAL_ROLES.map(x => x[2])} onPick={choose} btns={btns} />
    </div>
  )
  return as === 'qb' ? <GoalQB v={v} seed={seed} onDone={onDone} /> : <GoalCatch v={v} seed={seed} who={as} onDone={onDone} />
}
const GOAL_MEN = [['X', 'SLANT'], ['Y', 'CORNER'], ['Z', 'FADE']]
function GoalQB({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => ({ open: Math.floor(r() * 3), at: 750 + r() * 700, speed: 1.62 + r() * 0.2 }), [r])
  const T = reactMs(v) * 0.84                  // from the moment he's open to the pocket collapsing
  const [phase, setPhase] = useState('read')   // read → throw
  const [open, setOpen] = useState(false)
  const [beats, setBeats] = useState([])
  const [q1, setQ1] = useState(0)
  const R = useRef({ openAt: 0, done: false })
  const btns = useRef([]), fx = useRef(null), clock = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  useEffect(() => { const t = setTimeout(() => { R.current.openAt = now(); setOpen(true); haptic('light') }, plan.at); return () => clearTimeout(t) }, []) // eslint-disable-line
  const fail = (word, note, k = null, out = false) => {
    R.current.done = true; clock.current?.stop()
    if (k != null) { flash(btns.current[k], 'miss'); if (R.current.openAt) flash(btns.current[plan.open], 'hit') }
    say(fx.current, word, 'miss'); bad(); setBeats([false])
    end({ score: 0.1, hit: false, note, out })
  }
  const read = (k, e) => {
    const S = R.current
    if (S.done || phase !== 'read') return
    const ts = pressAt(e)
    if (!S.openAt || ts < S.openAt) return fail('FORCED IT', 'Threw it before anyone came open: picked off.', k)
    if (k !== plan.open) return fail('INTERCEPTED', 'Wrong man: the safety sat on it.', k)
    S.done = true; clock.current?.stop()
    const q = clamp(1 - Math.max(0, ts - S.openAt - REACT_FLOOR) / (T - REACT_FLOOR), 0.3, 1)
    flash(btns.current[k], 'hit'); say(fx.current, q >= 0.85 ? 'QUICK READ' : 'GOOD READ', 'hit'); good(q >= 0.85)
    setQ1(q); setBeats([true])
    later(() => setPhase('throw'), 420)
  }
  const thrown = j => {
    const [id, route] = GOAL_MEN[plan.open]
    if (j.hit) {
      say(fx.current, 'TOUCHDOWN', 'hit'); sfx('catchball'); haptic('heavy')
      setBeats([true, true])
      end({ score: clamp(0.45 * q1 + 0.55 * j.q, 0.5, 1), hit: true, note: `${q1 >= 0.85 ? 'Quick read' : 'Got there'} · ${j.q >= 0.85 ? 'perfect ball' : 'on the ' + route.toLowerCase()} to ${id}` })
    } else {
      say(fx.current, j.word === 'EARLY' ? 'OVERTHROWN' : 'BEHIND HIM', 'miss'); bad()
      setBeats([true, false])
      end({ score: 0.3 * q1, hit: false, note: `Right read, ${j.word === 'EARLY' ? 'sailed it over ' + id : 'threw it behind ' + id}.` })
    }
  }
  useKeys({ 1: e => read(0, e), 2: e => read(1, e), 3: e => read(2, e) })
  return (
    <div className="mg-play mg-play--calls mg-play--goal">
      {phase === 'read' ? <Clock ms={plan.at + T + 60} ctl={clock} onOut={() => { if (!R.current.done) fail('SACKED', 'Held it too long: the pocket collapsed.', null, true) }} /> : <div className="mg-clock is-spent" />}
      <div className="mg-box mg-goal-head"><Fx r={fx} /><span className="mg-look-eyebrow">4TH & GOAL AT THE 5</span><span className="mg-look">{phase === 'read' ? (open ? 'HE\'S OPEN: HIT HIM' : 'READ THE COVERAGE') : 'THROW IT'}</span></div>
      {phase === 'read' ? (
        <div className="mg-targets mg-men">{GOAL_MEN.map(([id, route], k) => (
          <button key={id} ref={el => { btns.current[k] = el }} className={`mg-target mg-man${open && k === plan.open ? ' is-open' : ''}`} onPointerDown={e => read(k, e)} aria-label={`${id} ${route}`}>
            <b>{id}</b><small>{route}</small><em>{open && k === plan.open ? 'OPEN' : 'COVERED'}</em><Kbd k={k + 1} /><Fl />
          </button>
        ))}</div>
      ) : (
        <BeatBar seed={`${seed}-throw`} width={zw(v) * (0.7 + 0.5 * q1)} speed={plan.speed} label={`${GOAL_MEN[plan.open][0]} · ${GOAL_MEN[plan.open][1]}`} fx={fx} onPress={thrown} />
      )}
      <Dots n={2} of={beats} />
    </div>
  )
}
const GOAL_FOE = { rb: ['THE LINEBACKER SITS', 'WALLED OFF'], wr: ['THE CORNER JAMS', 'JAMMED'], te: ['THE LINEBACKER JAMS', 'JAMMED'] }
function GoalCatch({ v, seed, who, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => ({ from: r() < 0.5 ? 'L' : 'R', at: 650 + r() * 650, speed: 1.68 + r() * 0.2 }), [r])
  const T = lanesMs(v) * 0.84
  const [foe, stuck] = GOAL_FOE[who] ?? GOAL_FOE.wr
  const [phase, setPhase] = useState('line')   // line → catch
  const [lean, setLean] = useState(null)
  const [beats, setBeats] = useState([])
  const [q1, setQ1] = useState(0)
  const R = useRef({ at: 0, done: false })
  const btns = useRef({}), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  useEffect(() => {
    const t1 = setTimeout(() => { R.current.at = now(); setLean(plan.from); haptic('light') }, plan.at)
    const t2 = setTimeout(() => { if (!R.current.done) fail('RE-ROUTED', 'Too slow off the line: the play was dead.', null, true) }, plan.at + T + 60)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // eslint-disable-line
  const fail = (word, note, side = null, out = false) => {
    R.current.done = true
    if (side) flash(btns.current[side], 'miss')
    say(fx.current, word, 'miss'); bad(); setBeats([false])
    end({ score: 0.1, hit: false, note, out })
  }
  const go = (side, e) => {
    const S = R.current
    if (S.done || phase !== 'line') return
    const ts = pressAt(e)
    if (!S.at || ts < S.at) return fail('FALSE STEP', 'Moved before he showed his hand.', side)
    if (side === plan.from) return fail(stuck, 'Went right into him.', side)
    S.done = true
    const q = clamp(1 - Math.max(0, ts - S.at - REACT_FLOOR) / (T - REACT_FLOOR), 0.3, 1)
    flash(btns.current[side], 'hit'); say(fx.current, q >= 0.85 ? 'CLEAN RELEASE' : 'FREE', 'hit'); good(q >= 0.85)
    setQ1(q); setBeats([true])
    later(() => setPhase('catch'), 420)
  }
  const caught = j => {
    if (j.hit) {
      say(fx.current, 'TOUCHDOWN', 'hit'); sfx('catchball'); haptic('heavy')
      setBeats([true, true])
      end({ score: clamp(0.45 * q1 + 0.55 * j.q, 0.5, 1), hit: true, note: `${q1 >= 0.85 ? 'Won off the line' : 'Got free'} · ${j.q >= 0.85 ? 'hands like glue' : 'held on'}` })
    } else {
      say(fx.current, j.word === 'EARLY' ? 'OFF HIS HANDS' : 'DROPPED', 'miss'); bad()
      setBeats([true, false])
      end({ score: 0.3 * q1, hit: false, note: `Got free, ${j.word === 'EARLY' ? 'reached too soon' : 'too late with the hands'}.` })
    }
  }
  useKeys({ ArrowLeft: e => go('L', e), ArrowRight: e => go('R', e), a: e => go('L', e), d: e => go('R', e) })
  return (
    <div className="mg-play mg-play--lanes mg-play--goal">
      <div className="mg-box mg-goal-head"><Fx r={fx} /><span className="mg-look-eyebrow">4TH & GOAL AT THE 5</span></div>
      {phase === 'line' ? (
        <>
          <div className="mg-box">
            <div className={`mg-rush${lean ? ` is-${lean}` : ''}`}><i>{lean === 'L' ? <><IconCaret dir="left" size={14} /> {foe}</> : lean === 'R' ? <>{foe} <IconCaret dir="right" size={14} /></> : 'SET'}</i></div>
          </div>
          <div className="mg-sides">
            <button className="mg-side" ref={el => { btns.current.L = el }} onPointerDown={e => go('L', e)}><IconCaret dir="left" size={14} /> LEFT<Fl /></button>
            <button className="mg-side" ref={el => { btns.current.R = el }} onPointerDown={e => go('R', e)}>RIGHT <IconCaret dir="right" size={14} /><Fl /></button>
          </div>
          <Hint>GO AWAY FROM HIM</Hint>
        </>
      ) : (
        <BeatBar seed={`${seed}-catch`} width={zw(v) * (0.7 + 0.5 * q1)} speed={plan.speed} label="HANDS" fx={fx} onPress={caught} hint="TO CATCH" />
      )}
      <Dots n={2} of={beats} />
    </div>
  )
}

// ── Beat the Press: hand fighting at the line ───────────────────────────────
// The corner gets a hand on him: swipe that hand off (LEFT or RIGHT, the side it's on). He re-jams,
// usually with the other hand, sometimes the same one again, so it's a read every time, not a
// rhythm. A wrong swipe whiffs and costs ground and a beat. The FREE meter fills with every clean
// swipe and leaks while he's held; full before the ball comes out is a clean release.
function Press({ v, seed, onDone }) {
  const r = useRng(seed)
  const T = 2600 + v * 75                      // the QB's drop: the ball is out at the end of it
  const push = 0.19 + v * 0.008, leak = 0.16
  const [side, setSide] = useState(null)       // the hand that's on him
  const [live, setLive] = useState(false)
  const S = useRef({ live: false, done: false, side: null, m: 0, last: 0, peak: 0, snapAt: 0, lock: 0, swipes: 0, whiffs: 0 })
  const fill = useRef(null), btns = useRef({}), fx = useRef(null), clock = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const jam = s => { S.current.side = s; setSide(s); haptic('light') }
  useEffect(() => {
    const t = setTimeout(() => { const s = S.current; s.live = true; s.snapAt = now(); setLive(true); sfx('whistle'); jam(r() < 0.5 ? 'L' : 'R') }, 700 + r() * 500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line
  const finish = (won, ts) => {
    const s = S.current; if (s.done) return
    s.done = true; s.live = false; clock.current?.stop(); setLive(false); setSide(null)
    const left = Math.max(0, T - (ts - s.snapAt))
    if (won) { say(fx.current, 'CLEAN RELEASE', 'hit'); good(true) } else { say(fx.current, 'JAMMED', 'miss'); bad() }
    end({ score: won ? clamp(0.6 + (left / T) * 0.9, 0.6, 1) : clamp(s.peak * 0.45, 0, 0.45), hit: won, out: !won,
      note: won ? `Free with ${(left / 1000).toFixed(1)}s to spare · ${s.swipes} swipes${s.whiffs ? ` · ${s.whiffs} whiffed` : ''}` : `Still in his hands when the ball came out · ${Math.round(s.peak * 100)}% free` })
  }
  // the hold: freedom leaks while he's got hands on
  useLoop(ts => {
    const s = S.current
    if (!s.live) return false
    const dt = Math.min(50, ts - (s.last || ts)) / 1000; s.last = ts
    s.m = Math.max(0, s.m - leak * dt)
    if (fill.current) fill.current.style.transform = `scaleX(${s.m})`
  }, live)
  const swipe = (k, e) => {
    const s = S.current
    if (s.done || !s.live) return
    const ts = pressAt(e)
    if (ts < s.lock) return                     // still off balance from a whiff
    if (s.side == null) { s.m = Math.max(0, s.m - 0.03); flash(btns.current[k], 'miss'); return }   // swiped at air
    if (k === s.side) {
      s.m = Math.min(1, s.m + push * (1 - s.m * 0.2)); s.swipes++; s.peak = Math.max(s.peak, s.m)
      flash(btns.current[k], 'hit'); sfx('tap'); haptic('light')
      if (fill.current) fill.current.style.transform = `scaleX(${s.m})`
      if (s.m >= 1) { finish(true, ts); return }
      // the re-jam: usually the other hand, sometimes the same one again
      const nextSide = r() < 0.7 ? (k === 'L' ? 'R' : 'L') : k
      s.side = null; setSide(null)
      later(() => { if (!S.current.done) jam(nextSide) }, 110 + r() * 110)
    } else {
      s.m = Math.max(0, s.m - 0.1); s.whiffs++; s.lock = ts + 260
      flash(btns.current[k], 'miss'); say(fx.current, 'WHIFF', 'miss'); sfx('pop'); haptic('heavy')
    }
  }
  useKeys({ ArrowLeft: e => swipe('L', e), ArrowRight: e => swipe('R', e), a: e => swipe('L', e), d: e => swipe('R', e) })
  return (
    <div className="mg-play mg-play--lanes mg-play--press">
      {live || S.current.done ? <Clock ms={T} ctl={clock} onOut={() => finish(false, now())} /> : <div className="mg-clock" />}
      <div className="mg-box">
        <Fx r={fx} />
        <div className={`mg-jam${side ? ` is-${side}` : ''}`}>
          <span className="mg-jam-hand">{side === 'L' ? 'HAND ON' : ''}</span>
          <b>{live ? (side ? 'CORNER' : 'RE-JAM') : 'PRESS'}</b>
          <span className="mg-jam-hand">{side === 'R' ? 'HAND ON' : ''}</span>
        </div>
      </div>
      <div className="mg-lane mg-pile mg-free"><span className="mg-pile-fill" ref={fill} /><i className="mg-free-lbl">FREE</i><span className="mg-goal" /></div>
      <div className="mg-sides">
        <button className="mg-side" ref={el => { btns.current.L = el }} onPointerDown={e => swipe('L', e)}><IconCaret dir="left" size={14} /> SWIPE<Fl /></button>
        <button className="mg-side" ref={el => { btns.current.R = el }} onPointerDown={e => swipe('R', e)}>SWIPE <IconCaret dir="right" size={14} /><Fl /></button>
      </div>
      {!S.current.done && (live ? <Hint touch="SWIPE" desk="← →">THE HAND THAT'S ON HIM</Hint> : <Hint>WAIT FOR THE SNAP</Hint>)}
    </div>
  )
}

// ── Seal the Edge: a drive block ────────────────────────────────────────────
// Hold DRIVE to push into him, ease off to settle; he pushes back all the time and surges every so
// often (SURGE shows just before). Keep the needle in the green band: time in it fills SEALED.
// Driven back to the end is beaten; drive through to the far end and he slips off a lunge.
function Seal({ v, seed, onDone }) {
  const r = useRng(seed)
  const band = (0.26 + v * 0.012) * 0.85       // the band's width (of the bar), centred
  const NEED = 1.9, LIMIT = 3.6                // seconds in the band to seal it, inside the play
  const surges = useMemo(() => { const l = []; let t = 0.55 + r() * 0.4; while (t < LIMIT) { l.push(t); t += 0.8 + r() * 0.55 } return l }, [r])
  const [live, setLive] = useState(false)
  const [held, setHeld] = useState(false)
  const S = useRef({ live: false, done: false, x: 0.5, vel: 0, held: false, last: 0, snapAt: 0, inBand: 0, id: null, cue: false })
  const needle = useRef(null), prog = useRef(null), cue = useRef(null), btn = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  useEffect(() => {
    const t = setTimeout(() => { const s = S.current; s.live = true; s.snapAt = now(); setLive(true); sfx('whistle'); haptic('medium') }, 650 + r() * 450)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line
  const finish = (won, why) => {
    const s = S.current; if (s.done) return
    s.done = true; s.live = false; setLive(false)
    cue.current?.classList.remove('is-on')
    const f = Math.min(1, s.inBand / NEED)
    if (won) { say(fx.current, 'SEALED', 'hit'); flash(btn.current, 'hit'); good(true) } else { say(fx.current, why === 'back' ? 'DRIVEN BACK' : why === 'lunge' ? 'LUNGED' : 'BEAT ON THE EDGE', 'miss'); bad() }
    end({ score: won ? clamp(0.6 + (1 - (now() - s.snapAt) / 1000 / LIMIT) * 0.9, 0.6, 1) : f * 0.45, hit: won,
      note: won ? 'Held his ground through every surge' : why === 'back' ? 'Pushed into the backfield.' : why === 'lunge' ? 'Overextended: he slipped off the block.' : `Sealed ${Math.round(f * 100)}% of the way` })
  }
  useLoop(ts => {
    const s = S.current
    if (!s.live) return false
    const dt = Math.min(50, ts - (s.last || ts)) / 1000; s.last = ts
    const tt = (ts - s.snapAt) / 1000
    // his push: steady, plus a surge now and then (shown 0.3s ahead)
    let F = 0.5 - v * 0.012, warn = false
    for (const t0 of surges) {
      if (tt >= t0 && tt < t0 + 0.45) F += 1.3 * Math.sin(Math.PI * (tt - t0) / 0.45)
      if (tt >= t0 - 0.3 && tt < t0 + 0.45) warn = true
    }
    if (warn !== s.cue) { s.cue = warn; cue.current?.classList.toggle('is-on', warn); if (warn) haptic('light') }
    s.vel += ((s.held ? 1.15 : 0) - F) * dt * 1.6
    s.vel *= Math.exp(-2.4 * dt)
    s.x += s.vel * dt
    if (Math.abs(s.x - 0.5) <= band / 2) s.inBand += dt
    if (needle.current) needle.current.style.transform = `translate3d(${clamp(s.x, 0, 1) * 100}%,0,0)`
    if (prog.current) prog.current.style.transform = `scaleX(${Math.min(1, s.inBand / NEED)})`
    if (s.x <= 0) finish(false, 'back')
    else if (s.x >= 1) finish(false, 'lunge')
    else if (s.inBand >= NEED) finish(true)
    else if (tt >= LIMIT) finish(false, 'time')
  }, live)
  const down = e => {
    const s = S.current
    if (s.held || s.done) return
    if (e?.pointerId != null) { s.id = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId) } catch {} } else s.id = null
    s.held = true; setHeld(true); haptic('light')
  }
  const up = e => {
    const s = S.current
    if (!s.held || (e?.pointerId != null && s.id != null && e.pointerId !== s.id)) return
    s.held = false; setHeld(false)
  }
  useKeys({ ' ': down }, { ' ': up })
  return (
    <div className="mg-play mg-play--seal" onPointerDown={primary(down)} onPointerUp={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()}>
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-bar mg-seal" aria-hidden="true">
          <span className="mg-zone mg-seal-band" style={{ left: `${50 - band * 50}%`, width: `${band * 100}%` }} />
          <i className="mg-seal-end is-l">BACKFIELD</i><i className="mg-seal-end is-r">LUNGE</i>
          <span className="mg-seal-surge" ref={cue}>SURGE</span>
          <span className="mg-track" ref={needle} style={{ transform: 'translate3d(50%,0,0)' }}><span className="mg-marker" /></span>
        </div>
      </div>
      <div className="mg-seal-prog"><i>SEALED</i><span ref={prog} /></div>
      <button className={`mg-foot mg-push${held ? ' is-held' : ''}`} ref={btn} aria-label="Drive">DRIVE<Kbd k="SPACE" /><Fl /></button>
      {S.current.done ? null : live ? <Hint touch="HOLD" desk="HOLD SPACE">TO DRIVE · KEEP IT IN THE GREEN</Hint> : <Hint>SET · WAIT FOR THE SNAP</Hint>}
    </div>
  )
}

// ── Pass Rush: read the tackle's set, hit the move that beats it ────────────
// Three snaps. On each, the tackle shows his set, and each set has one answer: high hands get swum
// over, a soft anchor gets run through, an overset gets spun back inside. The move has to be on
// before he recovers. Moving before the snap is offside.
const RUSH_MOVES = [['SWIM', 'Beats high hands'], ['BULL RUSH', 'Beats a soft anchor'], ['SPIN', 'Beats an overset']]
const RUSH_SETS = [
  { move: 0, set: 'HIGH HANDS', tell: 'He reaches early' },
  { move: 1, set: 'SOFT ANCHOR', tell: 'On his heels, weight back' },
  { move: 2, set: 'OVERSETS WIDE', tell: 'He bailed outside: the inside is open' },
]
function Rush({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => { let last = -1; return [0, 1, 2].map(() => { let s = Math.floor(r() * 3); if (s === last) s = (s + 1 + Math.floor(r() * 2)) % 3; last = s; return { set: s, delay: 650 + r() * 600 } }) }, [r])
  const T = lanesMs(v) * 0.84 + 300            // (three answers to read: a little longer than a cut)
  const [i, setI] = useState(0)
  const [set, setSet] = useState(null)
  const [scores, setScores] = useState([])
  const R = useRef({ set: null, at: 0, done: false })
  const outs = useRef(0), sacks = useRef(0), btns = useRef([]), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  useEffect(() => {
    setSet(null); R.current = { set: null, at: 0, done: false }
    const t1 = setTimeout(() => { R.current.set = plan[i].set; R.current.at = now(); setSet(plan[i].set); sfx('whistle') }, plan[i].delay)
    const t2 = setTimeout(() => { outs.current++; settle(0, 'PICKED UP') }, plan[i].delay + T + 60)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = (s, word, k = null) => {
    if (R.current.done) return
    R.current.done = true
    const right = R.current.set != null ? RUSH_SETS[R.current.set].move : null
    if (k != null) showCall(btns, k, right, !!s)
    if (s) { const sack = s >= 0.8; if (sack) sacks.current++; say(fx.current, sack ? 'SACK' : 'PRESSURE', 'hit'); sfx('stamp'); haptic(sack ? 'heavy' : 'medium') }
    else { say(fx.current, word, 'miss'); bad() }
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length, avg = next.reduce((a, b) => a + b, 0) / plan.length
      const hit = made >= 2
      end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: [sacks.current && `${sacks.current} sack${sacks.current === 1 ? '' : 's'}`, made - sacks.current && `${made - sacks.current} pressure${made - sacks.current === 1 ? '' : 's'}`, plan.length - made && `stopped ${plan.length - made === 1 ? 'once' : `${plan.length - made} times`}`].filter(Boolean).join(' · '), out: outs.current > 0 && outs.current >= plan.length - made, raw: { made, of: plan.length } })
    } else later(() => setI(i + 1), 520)
  }
  const move = (k, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (S.set == null || ts < S.at) { settle(0, 'OFFSIDE', k); return }
    if (RUSH_SETS[S.set].move !== k) { settle(0, 'STONED', k); return }
    settle(clamp(1 - Math.max(0, ts - S.at - REACT_FLOOR) / (T - REACT_FLOOR), 0.4, 1), null, k)
  }
  useKeys({ 1: e => move(0, e), 2: e => move(1, e), 3: e => move(2, e) })
  const cur = set != null ? RUSH_SETS[set] : null
  return (
    <div className="mg-play mg-play--calls mg-play--rush">
      <div className={`mg-box mg-box--look mg-set${cur ? ' is-on' : ''}`}>
        <Fx r={fx} />
        <span className="mg-look-eyebrow">{cur ? 'THE TACKLE SETS' : `SNAP ${i + 1} OF ${plan.length}`}</span>
        <span className="mg-look mg-look--big">{cur ? cur.set : 'SET'}</span>
        <span className="mg-set-tell">{cur ? cur.tell : 'Read his set on the snap'}</span>
      </div>
      <Calls key={i} items={RUSH_MOVES.map(m => m[0])} sub={RUSH_MOVES.map(m => m[1])} onPick={move} btns={btns} />
      <Dots n={plan.length} of={scores} />
    </div>
  )
}

// ── Stuff the Run: read the gap, fill it ────────────────────────────────────
// Four handoffs. The back heads for a gap; on most he presses one first and cuts back. Fill the gap
// he commits to, before he gets there: jump it early and he sees it and cuts away; the wrong gap
// or a late fill and he's through for yards.
const GAPS = [{ x: 16.7, name: 'LEFT' }, { x: 50, name: 'MIDDLE' }, { x: 83.3, name: 'RIGHT' }]
const at2 = (x, y) => `translate3d(${x}%,${y}%,0)`
function Stuff({ v, seed, onDone }) {
  const r = useRng(seed)
  const rounds = 4
  const plan = useMemo(() => Array.from({ length: rounds }, (_, k) => {
    const real = Math.floor(r() * 3), fake = k > 0 && r() < 0.65 ? (real + 1 + Math.floor(r() * 2)) % 3 : null
    return { real, fake, delay: 600 + r() * 600, fakeMs: 300 + r() * 160, gain: 3 + Math.floor(r() * 6) }
  }), [r])
  const T = reactMs(v) * 0.84 * 0.95             // from his cut to him hitting the line
  const [i, setI] = useState(0)
  const [scores, setScores] = useState([])
  const R = useRef({ cAt: 0, done: false, anim: null })
  const outs = useRef(0), baited = useRef(false), losses = useRef(0), back = useRef(null), btns = useRef([]), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  useEffect(() => {
    const p = plan[i], hand = now() + p.delay, cAt = hand + (p.fake != null ? p.fakeMs : 0)
    R.current = { cAt, done: false, anim: null }
    // his run, on the compositor: from the backfield (toward the fake first), to the line, through it
    const fr = [{ transform: at2(50, 86), offset: 0 }]
    const total = cAt + T + 380 - hand
    if (p.fake != null) fr.push({ transform: at2(50 + (GAPS[p.fake].x - 50) * 0.6, 66), offset: p.fakeMs / total })
    fr.push({ transform: at2(GAPS[p.real].x, 40), offset: (cAt + T - hand) / total })
    fr.push({ transform: at2(GAPS[p.real].x, 4), offset: 1 })
    if (back.current) { back.current.style.transform = ''; R.current.anim = glide(back.current, fr, total, hand, { fill: 'both', easing: 'linear' }) }
    const t = setTimeout(() => { outs.current++; settle(0, `+${p.gain} · LATE`) }, cAt + T + 40 - now())
    return () => clearTimeout(t)
  }, [i]) // eslint-disable-line
  const settle = (s, word, k = null) => {
    const S = R.current
    if (S.done) return
    S.done = true
    const p = plan[i]
    if (k != null) flash(btns.current[k], s ? 'hit' : 'miss')
    if (!s && k !== p.real) flash(btns.current[p.real], 'hit')
    if (s) {
      S.anim?.pause()                                // met in the hole: he stops right there
      const tfl = s >= 0.85; if (tfl) losses.current++
      say(fx.current, tfl ? 'TACKLE FOR LOSS' : 'STUFFED', 'hit'); sfx('stamp'); haptic('heavy')
    } else { say(fx.current, word, 'miss'); bad() }
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= rounds) {
      const made = next.filter(Boolean).length, avg = next.reduce((a, b) => a + b, 0) / rounds, hit = made >= rounds - 1
      later(() => end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: hit ? `${made} of ${rounds} stuffed${losses.current ? ` · ${losses.current} for a loss` : ''}` : baited.current ? `${made} of ${rounds} · bit on the cutback` : `${made} of ${rounds} stuffed`, out: outs.current > 0 && outs.current >= rounds - made, raw: { made, of: rounds } }), 250)
    } else later(() => setI(i + 1), 700)
  }
  const fill = (k, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e), p = plan[i]
    if (ts < S.cAt) {
      if (p.fake != null && k === p.fake) { baited.current = true; settle(0, `CUTBACK · +${p.gain + 3}`, k) }
      else settle(0, `EARLY · HE CUT AWAY`, k)
      return
    }
    if (k !== p.real) { settle(0, `WRONG GAP · +${p.gain}`, k); return }
    settle(clamp(1 - Math.max(0, ts - S.cAt - REACT_FLOOR) / (T - REACT_FLOOR), 0.4, 1), null, k)
  }
  useKeys({ 1: e => fill(0, e), 2: e => fill(1, e), 3: e => fill(2, e), ArrowLeft: e => fill(0, e), ArrowUp: e => fill(1, e), ArrowDown: e => fill(1, e), ArrowRight: e => fill(2, e) })
  return (
    <div className="mg-play mg-play--targets mg-play--stuff">
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-stuff" aria-hidden="true">
          <span className="mg-stuff-los" />
          {[4, 33.3, 66.7, 96].map(x => <i key={x} className="mg-stuff-ol" style={{ left: `${x}%` }} />)}
          <span className="mg-stuff-track" ref={back}><span className="mg-stuff-back" /></span>
        </div>
      </div>
      <div className="mg-targets mg-gaps">{GAPS.map((g, k) => <button key={g.name} ref={el => { btns.current[k] = el }} className="mg-target mg-gap" onPointerDown={e => fill(k, e)} aria-label={`${g.name} gap`}><b>{g.name}</b><Kbd k={k + 1} /><Fl /></button>)}</div>
      <Hint>FILL THE GAP HE HITS</Hint>
      <Dots n={rounds} of={scores} />
    </div>
  )
}

// ═══ Basketball: Lockdown, Fast Break, Alley-Oop ═══════════════════════════
// Each court is a box the dots move on: every .mg-pt track is the court's own size, so a dot at
// at2(x, y) sits at x% / y% of the court, and every move is a Web Animation on the compositor.
// where a dot is right now (as % of its court), and a freeze there
function spot(el) {
  if (!el) return { x: 50, y: 50 }
  const t = getComputedStyle(el).transform
  const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : new DOMMatrixReadOnly()
  return { x: (m.m41 / (el.offsetWidth || 1)) * 100, y: (m.m42 / (el.offsetHeight || 1)) * 100 }
}
function freeze(el) { const p = spot(el); halt(el); if (el) el.style.transform = at2(p.x, p.y); return p }
// a dot from wherever it is to (x, y)
function moveTo(el, x, y, ms, easing = 'ease-out') {
  if (!el) return
  const p = freeze(el)
  glide(el, [{ transform: at2(p.x, p.y) }, { transform: at2(x, y) }], ms, now(), { easing })
}

// ── Lockdown: on the ball, slide with him ───────────────────────────────────
// Three moves, each a little quicker. He attacks a side: slide that way before he turns the corner.
// After the first, some are hesitations: he shows a side, plants and crosses back the other way.
// Slide on the show and he's by you. The tell is in his feet: a drive keeps coming, a hesi stops
// short. Two stops win it.
const LOCK_X = { L: 22, R: 78 }
const flip = s => (s === 'L' ? 'R' : 'L')
function Lockdown({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => {
    const p = [0, 1, 2].map(k => ({ show: r() < 0.5 ? 'L' : 'R', hes: k > 0 && r() < 0.55, delay: (650 + r() * 650) * (1 - k * 0.1), hold: 300 + r() * 170, pace: 1 - k * 0.06 }))
    if (!p.some(x => x.hes)) p[1 + Math.floor(r() * 2)].hes = true
    return p
  }, [r])
  const [i, setI] = useState(0)
  const [cue, setCue] = useState(null)          // the side he's going (the show, then the cross)
  const [scores, setScores] = useState([])
  const R = useRef({ show: 0, go: 0, side: null, T: 0, done: false })
  const outs = useRef(0), bit = useRef(0), btns = useRef({}), fx = useRef(null), him = useRef(null), me = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const p = plan[i], T = lanesMs(v) * 0.84 * p.pace, show = now() + p.delay
    const go = p.hes ? show + p.hold : show, side = p.hes ? flip(p.show) : p.show, X = LOCK_X[side]
    R.current = { show, go, side, T, done: false }
    setCue(null)
    if (me.current) { halt(me.current); me.current.style.transform = at2(50, 62) }
    // his move: a drive comes straight on; a hesi jabs a side, stops dead, then goes the other way
    const total = go - show + T + 420
    const fr = [{ transform: at2(50, 24), offset: 0, easing: p.hes ? 'ease-out' : 'linear' }]
    if (p.hes) {
      const sx = 50 + (LOCK_X[p.show] - 50) * 0.4
      fr.push({ transform: at2(sx, 31), offset: 200 / total }, { transform: at2(sx, 31), offset: (go - show) / total })
    }
    fr.push({ transform: at2(X, 58), offset: (go - show + T) / total }, { transform: at2(X, 98), offset: 1 })
    if (him.current) { him.current.style.transform = ''; glide(him.current, fr, total, show) }
    const ts = [
      setTimeout(() => { setCue(p.show); haptic('light') }, p.delay),
      setTimeout(() => { outs.current++; settle(0, 'BLOW-BY') }, go - now() + T + 60),
    ]
    if (p.hes) ts.push(setTimeout(() => { if (!R.current.done) setCue(side) }, go - now()))
    return () => ts.forEach(clearTimeout)
  }, [i]) // eslint-disable-line
  const settle = (s, word, side = null) => {
    const S = R.current
    if (S.done) return
    S.done = true
    if (side) { moveTo(me.current, LOCK_X[side], 62, 120); flash(btns.current[side], s ? 'hit' : 'miss') }
    if (s) {
      moveTo(him.current, LOCK_X[S.side], 45, 200)      // he runs into you and backs it out
      say(fx.current, s >= 0.85 ? 'LOCKED UP' : 'STOP', 'hit'); sfx('stamp'); haptic(s >= 0.85 ? 'heavy' : 'medium')
    } else {
      if (side) moveTo(him.current, LOCK_X[flip(side)], 98, 300, 'ease-in')   // by you, on the side you gave him
      say(fx.current, word, 'miss'); bad()
    }
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length, avg = next.reduce((a, b) => a + b, 0) / plan.length, hit = made >= 2
      later(() => end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: `${made} of 3 stops${bit.current ? ` · bit on ${bit.current === 1 ? 'a hesi' : `${bit.current} hesis`}` : ''}`, out: outs.current > 0 && outs.current >= 3 - made, raw: { made, of: 3 } }), 250)
    } else later(() => setI(i + 1), 750)
  }
  const slide = (side, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e), p = plan[i]
    if (ts < S.show) return settle(0, 'REACHED EARLY', side)
    if (ts < S.go) {
      if (side === p.show) { bit.current++; return settle(0, 'ANKLES', side) }
      return settle(0, 'GUESSED', side)
    }
    if (side !== S.side) return settle(0, p.hes ? 'CROSSED UP' : 'WRONG WAY', side)
    settle(clamp(1 - Math.max(0, ts - S.go - REACT_FLOOR) / (S.T - REACT_FLOOR), 0.4, 1), null, side)
  }
  useKeys({ ArrowLeft: e => slide('L', e), ArrowRight: e => slide('R', e), a: e => slide('L', e), d: e => slide('R', e) })
  const crossed = cue && plan[i].hes && cue !== plan[i].show
  const word = crossed ? 'CROSS' : 'DRIVE'
  return (
    <div className="mg-play mg-play--lanes mg-play--lock">
      <div className="mg-box">
        <Fx r={fx} />
        <div className={`mg-rush${cue ? ` is-${cue}` : ''}`}><i>{cue === 'L' ? <><IconCaret dir="left" size={14} /> {word}</> : cue === 'R' ? <>{word} <IconCaret dir="right" size={14} /></> : `MOVE ${i + 1} OF 3`}</i></div>
      </div>
      <div className="mg-court mg-court--lock" aria-hidden="true">
        <span className="mg-court-arc" /><span className="mg-court-paint" />
        <span className="mg-pt" ref={him} style={{ transform: at2(50, 24) }}><span className="mg-dot is-them" /></span>
        <span className="mg-pt" ref={me} style={{ transform: at2(50, 62) }}><span className="mg-dot is-me" /></span>
      </div>
      <div className="mg-sides">
        <button className="mg-side" ref={el => { btns.current.L = el }} onPointerDown={e => slide('L', e)}><IconCaret dir="left" size={14} /> SLIDE<Fl /></button>
        <button className="mg-side" ref={el => { btns.current.R = el }} onPointerDown={e => slide('R', e)}>SLIDE <IconCaret dir="right" size={14} /><Fl /></button>
      </div>
      <Dots n={3} of={scores} />
    </div>
  )
}

// ── Get a Bucket: one possession, two beats ─────────────────────────────────
// His man shows you what he's giving you. He leans a side: cross him the other way and you're downhill to the
// rim, a layup's window. He sags off: pull up, a jumper's window (tighter). Hesitate and he's set, guess before
// he shows anything and he picks the pocket. Then the finish: the bar, in the zone.
function Bucket({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => ({ look: r() < 0.68 ? (r() < 0.5 ? 'L' : 'R') : 'sag', delay: 650 + r() * 700, zone: 30 + r() * 40, speed: 1.55 + r() * 0.25 }), [r])
  const [phase, setPhase] = useState('read')   // read, then shot, then done
  const [cue, setCue] = useState(null)
  const [drive, setDrive] = useState(false)
  const S = useRef({ at: 0, T: 0, done: false, readQ: 1 })
  const btns = useRef({}), fx = useRef(null), him = useRef(null), me = useRef(null), shotTap = useRef(null)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const T = lanesMs(v) * 0.9
    S.current = { at: now() + plan.delay, T, done: false, readQ: 1 }
    const ts = [
      setTimeout(() => { setCue(plan.look); haptic('light'); if (plan.look !== 'sag') moveTo(him.current, LOCK_X[plan.look] * 0.5 + 25, 30, 220); else moveTo(him.current, 50, 18, 260) }, plan.delay),
      setTimeout(() => { if (!S.current.done) lose('CUT OFF', 'Too slow: he sat down in front.', true) }, plan.delay + T + 60),
    ]
    return () => ts.forEach(clearTimeout)
  }, []) // eslint-disable-line
  const lose = (word, note, out = false) => {
    const st = S.current
    if (st.done) return
    st.done = true
    say(fx.current, word, 'miss'); bad()
    setPhase('done')
    later(() => end({ score: 0.1, hit: false, note, out, raw: { made: 0, of: 1, pts: 2 } }), 650)
  }
  const pick = (k, e) => {
    const st = S.current
    if (st.done || phase !== 'read') return
    const ts = pressAt(e)
    flash(btns.current[k], 'hit')
    if (ts < st.at) return lose(k === 'S' ? 'FORCED IT' : 'STRIPPED', 'Went before he showed anything.')
    const want = plan.look === 'sag' ? 'S' : flip(plan.look)
    if (k !== want) return lose(k === 'S' ? 'BLOCKED' : plan.look === 'sag' ? 'CUT OFF' : 'STRIPPED', plan.look === 'sag' ? 'He gave up the shot.' : 'Went right into him.')
    st.done = true
    st.readQ = clamp(1 - Math.max(0, ts - st.at - 380) / Math.max(1, st.T - 380), 0.5, 1)
    good(st.readQ > 0.85)
    if (k !== 'S') { setDrive(true); moveTo(me.current, LOCK_X[k], 22, 300); say(fx.current, 'CROSSED HIM', 'hit') }
    else say(fx.current, 'SPACE', 'hit')
    later(() => setPhase('shot'), 420)
  }
  useKeys({ ArrowLeft: e => pick('L', e), ArrowRight: e => pick('R', e), a: e => pick('L', e), d: e => pick('R', e), ' ': e => pick('S', e), Enter: e => pick('S', e) })
  const word = cue === 'sag' ? 'HE SAGS OFF' : cue ? 'HE LEANS' : 'SIZE HIM UP'
  const shot = j => end({ score: j.hit ? clamp(0.55 + 0.45 * j.q * S.current.readQ, 0, 1) : 0.2, hit: j.hit, note: j.hit ? (drive ? 'Crossed him, finished at the rim' : 'Pulled up over him') : j.note, raw: { made: j.hit ? 1 : 0, of: 1, pts: 2 } })
  return (
    <div className="mg-play mg-play--lanes mg-play--lock" onPointerDown={phase === 'shot' ? primary(e => shotTap.current?.(e)) : undefined}>
      {phase === 'shot' ? <BucketShot v={v} zone={plan.zone} speed={plan.speed} drive={drive} ended={ended} onShot={shot} tapRef={shotTap} /> : (
        <div className="mg-box">
          <Fx r={fx} />
          <div className={`mg-rush${cue === 'L' || cue === 'R' ? ` is-${cue}` : ''}`}><i>{cue === 'L' ? <><IconCaret dir="left" size={14} /> {word}</> : cue === 'R' ? <>{word} <IconCaret dir="right" size={14} /></> : word}</i></div>
        </div>
      )}
      <div className="mg-court mg-court--lock" aria-hidden="true">
        <span className="mg-court-arc" /><span className="mg-court-paint" />
        <span className="mg-pt" ref={him} style={{ transform: at2(50, 30) }}><span className="mg-dot is-them" /></span>
        <span className="mg-pt" ref={me} style={{ transform: at2(50, 62) }}><span className="mg-dot is-me" /></span>
      </div>
      {phase === 'shot' ? null : (
        <div className="mg-sides mg-sides--pro">
          <button className="mg-side" ref={el => { btns.current.L = el }} onPointerDown={e => pick('L', e)}><IconCaret dir="left" size={14} /> CROSS<Fl /></button>
          <button className="mg-side mg-side--punch" ref={el => { btns.current.S = el }} onPointerDown={e => pick('S', e)}>SHOOT<Fl /></button>
          <button className="mg-side" ref={el => { btns.current.R = el }} onPointerDown={e => pick('R', e)}>CROSS <IconCaret dir="right" size={14} /><Fl /></button>
        </div>
      )}
    </div>
  )
}
// the finish: its own piece, so the bar starts sweeping as it comes up
function BucketShot({ v, zone, speed, drive, ended, onShot, tapRef }) {
  const width = zw(v) * (drive ? 1.35 : 1)
  const mark = useRef(null), zoneEl = useRef(null), fx = useRef(null), done = useRef(false)
  const { at, dir, stop } = useSweep(mark, speed)
  const tap = e => {
    if (done.current || ended.current) return
    done.current = true
    const ts = pressAt(e), p = at(ts) * 100, j = judgeBar(p, zone, width, dir(ts))
    stop(p); flash(zoneEl.current, j.hit ? 'hit' : 'miss'); say(fx.current, j.hit ? (drive ? 'AND IN' : 'BUCKET') : j.word, j.hit ? 'hit' : 'miss')
    j.hit ? good(j.q >= 0.85) : bad()
    onShot(j)
  }
  tapRef.current = tap
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div>
      <Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={zone} width={width} label={drive ? 'LAYUP' : 'JUMPER'} />
      <Hint touch="TAP" desk="SPACE">IN THE ZONE</Hint>
    </div>
  )
}

// ── Pass Pro: a tackle's pass set ───────────────────────────────────────────
// Four snaps, each a little quicker. He shows his rush: a speed rush wide, a counter (wide, then back
// inside), a bull straight on, or on the last snap two men at once (a twist or a blitz). Slide the way he
// really goes, then PUNCH as the ring closes on him. Against the bull, hold PUNCH until he's stopped.
// Early punch: he swipes it. Late: he's into your chest. Either way the QB's hurried. Wrong way, too slow,
// or walked into the QB: a sack. Moving before the snap is a false start. Clean 2, hurried 1: five holds it.
const PRO_STALL = v => 820 - v * 20, PRO_GIVE = v => 0.65 - v * 0.025, PRO_DRIVE = 650
const PRO_WORD = { speed: 'SPEED RUSH', counter: 'COUNTER', bull: 'BULL RUSH', stunt: 'TWIST', blitz: 'BLITZ' }
function Pro({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => {
    const s = r() < 0.5 ? -1 : 1, A = r() < 0.5 ? 'counter' : 'bull'
    const kinds = ['speed', A, A === 'counter' ? 'bull' : 'counter', r() < 0.5 ? 'stunt' : 'blitz']
    return { s, snaps: kinds.map((kind, k) => ({ kind, delay: (750 + r() * 600) * (1 - k * 0.06), hard: k > 0 && r() < 0.45 ? 0.45 + r() * 0.25 : null, pace: [1, 0.96, 0.92, 0.9][k] })) }
  }, [r])
  const s = plan.s, MX = 50 + s * 20
  const [i, setI] = useState(0)
  const [cue, setCue] = useState(null)            // { word, side }
  const [ring, setRing] = useState(false)
  const [anchor, setAnchor] = useState(false)
  const [scores, setScores] = useState([])
  const R = useRef({ phase: 'set', done: true })
  const pts = useRef({ clean: 0, hurried: 0, sacks: 0, flags: 0 })
  const fx = useRef(null), him = useRef(null), two = useRef(null), me = useRef(null), ringEl = useRef(null), holdEl = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const p = plan.snaps[i], T = lanesMs(v) * 0.84 * p.pace * (p.kind === 'stunt' || p.kind === 'blitz' ? 1.12 : 1)
    const snapAt = now() + p.delay, showAt = snapAt + 150
    const fake = p.kind === 'counter' ? s : null
    const dir = p.kind === 'speed' ? s : p.kind === 'counter' ? -s : p.kind === 'stunt' ? s : p.kind === 'blitz' ? -s : 0
    const goAt = p.kind === 'counter' ? showAt + 300 : p.kind === 'stunt' || p.kind === 'blitz' ? showAt + 220 : showAt
    R.current = { phase: 'set', done: false, kind: p.kind, snapAt, showAt, goAt, fake, dir, T, until: goAt + T, bit: false, depth: 0, holdMs: 0, held: false, last: 0, hardAt: p.hard != null ? snapAt - p.delay * (1 - p.hard) : null }
    setCue(null); setRing(false); setAnchor(false)
    const two0 = p.kind === 'stunt' ? [MX - s * 22, 30] : p.kind === 'blitz' ? [MX - s * 10, 10] : null
    for (const [el, x, y] of [[me.current, MX, 66], [him.current, MX + s * 9, 36], [two.current, ...(two0 ?? [MX, -20])]]) { if (el) { halt(el); el.style.transform = at2(x, y) } }
    if (two.current) two.current.style.opacity = two0 ? 1 : 0
    const ts = []
    if (R.current.hardAt != null) ts.push(setTimeout(() => { if (R.current.phase === 'set') { setCue({ word: 'HUT…' }); haptic('light') } }, R.current.hardAt - now()))
    ts.push(setTimeout(() => { if (R.current.done) return; R.current.phase = 'snap'; setCue({ word: 'SNAP' }); sfx('whistle') }, snapAt - now()))
    ts.push(setTimeout(() => {
      const S = R.current
      if (S.done) return
      S.phase = p.kind === 'bull' ? 'bull' : 'read'
      if (p.kind === 'speed') { setCue({ word: PRO_WORD.speed, side: s }); moveTo(him.current, MX + s * 26, 54, T + 150) }
      else if (p.kind === 'counter') { setCue({ word: PRO_WORD.speed, side: s }); moveTo(him.current, MX + s * 20, 44, 300) }
      else if (p.kind === 'bull') {
        setCue({ word: PRO_WORD.bull }); moveTo(him.current, MX, 56, 300, 'ease-in')
        S.contactAt = now() + 300
        later(() => { if (!R.current.done) { R.current.phase = 'anchor'; R.current.last = now(); setAnchor(true) } }, 300)
      } else {
        setCue({ word: PRO_WORD[p.kind] })
        moveTo(him.current, MX + s * 2, 42, 220); moveTo(two.current, MX - s * 4, 32, 220)
      }
      haptic('light')
    }, showAt - now()))
    if (p.kind === 'counter') ts.push(setTimeout(() => { if (!R.current.done && R.current.phase === 'read') { setCue({ word: PRO_WORD.counter, side: -s }); moveTo(him.current, MX - s * 12, 56, T) } }, goAt - now()))
    if (p.kind === 'stunt' || p.kind === 'blitz') ts.push(setTimeout(() => {
      if (R.current.done || R.current.phase !== 'read') return
      setCue({ word: 'FREE MAN', side: dir })
      if (p.kind === 'stunt') { moveTo(him.current, MX - s * 22, 46, 300); moveTo(two.current, MX + s * 22, 56, T) }   // the end crashes inside, the tackle loops round
      else { moveTo(him.current, MX + s * 30, 12, 400); moveTo(two.current, MX - s * 12, 56, T) }                     // the end drops out, the backer comes
    }, goAt - now()))
    if (p.kind !== 'bull') ts.push(setTimeout(() => { if (!R.current.done && R.current.phase === 'read') settle('sack', 'TOO SLOW') }, goAt + T + 60 - now()))
    return () => ts.forEach(clearTimeout)
  }, [i]) // eslint-disable-line
  // the man he has: the dot that's coming at him
  const rusher = () => (R.current.kind === 'stunt' || R.current.kind === 'blitz' ? two.current : him.current)
  const settle = (kind, word = null) => {
    const S = R.current
    if (S.done) return
    S.done = true; S.phase = 'done'
    setRing(false); setAnchor(false)
    if (kind === 'clean') { pts.current.clean++; say(fx.current, word ?? 'CLEAN POCKET', 'hit'); sfx('stamp'); haptic('medium') }
    else if (kind === 'hurried') { pts.current.hurried++; say(fx.current, word ?? 'HURRIED', 'hit'); haptic('light') }
    else {
      if (kind === 'sack') { pts.current.sacks++; moveTo(rusher(), 50, 90, 320, 'ease-in') } else pts.current.flags++
      say(fx.current, word ?? (kind === 'flag' ? 'FALSE START' : 'SACK'), 'miss'); bad()
    }
    const q = kind === 'clean' ? 0.6 + 0.4 * (S.q ?? 1) : kind === 'hurried' ? 0.35 : 0
    const next = [...scores, kind === 'clean' || kind === 'hurried' ? q : 0]
    setScores(next)
    if (i + 1 >= plan.snaps.length) {
      const P = pts.current, total = P.clean * 2 + P.hurried, hit = total >= 5, avg = next.reduce((a, b) => a + b, 0) / plan.snaps.length
      later(() => end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: [`${P.clean} clean`, P.hurried && `${P.hurried} hurried`, P.sacks && `${P.sacks} sack${P.sacks === 1 ? '' : 's'}`, P.flags && `${P.flags} false start${P.flags === 1 ? '' : 's'}`].filter(Boolean).join(' · '), out: P.sacks > 0 && !hit, raw: { made: P.clean, of: plan.snaps.length } }), 300)
    } else later(() => setI(i + 1), 850)
  }
  // with him: he closes, and the ring closes on him
  const toPunch = ts => {
    const S = R.current, side = S.dir
    S.q = clamp(1 - Math.max(0, ts - S.goAt - REACT_FLOOR) / (S.T - REACT_FLOOR), 0.4, 1)
    S.phase = 'punch'
    const ms = 380 * plan.snaps[i].pace, W = 120 + v * 10
    S.contactAt = now() + ms; S.early = S.contactAt - W / 2 - 25; S.late = S.contactAt + W / 2
    moveTo(me.current, MX + side * 10, 64, 160)
    moveTo(rusher(), MX + side * 12, 54, ms, 'linear')
    setRing(true)
    requestAnimationFrame(() => { const el = ringEl.current; if (el) glide(el, [{ transform: 'scale(2.6)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], ms, now(), { easing: 'linear' }) })
    later(() => { if (!R.current.done && R.current.phase === 'punch') settle('hurried', 'INTO HIS CHEST') }, S.late - now() + 30)
  }
  const slide = (side, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (S.phase === 'set') return settle('flag')
    if (S.phase === 'bull' || S.phase === 'anchor') { S.depth = Math.min(0.98, S.depth + 0.2); flash(btns.current[side], 'miss'); haptic('light'); return }
    if (S.phase !== 'read' || ts < S.showAt) return
    flash(btns.current[side], side === S.dir && ts >= S.goAt ? 'hit' : 'miss')
    if (S.fake && ts < S.goAt) {
      if (side === S.fake && !S.bit) { S.bit = true; S.until -= S.T * 0.3; moveTo(me.current, MX + side * 12, 66, 160) }
      else if (side !== S.fake) settle('sack', 'GUESSED')
      return
    }
    if ((S.kind === 'stunt' || S.kind === 'blitz') && ts < S.goAt) return
    if (side !== S.dir) return settle('sack', S.kind === 'stunt' || S.kind === 'blitz' ? 'FREE RUSHER' : 'BEAT')
    if (ts > S.until) return settle('sack', 'TOO SLOW')
    toPunch(ts)
  }
  const punchDown = e => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    S.held = true
    if (S.phase === 'set') return settle('flag')
    if (S.phase === 'bull' || S.phase === 'anchor') { holdEl.current?.classList.add('is-held'); return }
    if (S.phase === 'read' && ts >= S.showAt) return settle('hurried', 'LUNGED')
    if (S.phase !== 'punch') return
    flash(btns.current.P, ts >= S.early ? 'hit' : 'miss')
    if (ts < S.early) return settle('hurried', 'SWIPED')
    moveTo(rusher(), MX + S.dir * 12, 46, 180)
    settle('clean', Math.abs(ts - S.contactAt) <= (120 + v * 10) * 0.12 ? 'PANCAKE' : 'STONED')
  }
  const punchUp = () => { R.current.held = false; holdEl.current?.classList.remove('is-held') }
  // the bull: he drives, the anchor gives a little ground, and holding long enough stops his feet
  useLoop(ts => {
    const S = R.current
    if (S.done || S.phase !== 'anchor') return false
    const dt = Math.min(50, ts - (S.last || ts)); S.last = ts
    if (S.held) S.holdMs += dt
    S.depth += (dt / PRO_DRIVE) * (S.held ? PRO_GIVE(v) : 1)
    if (holdEl.current) holdEl.current.firstChild.style.transform = `scaleX(${Math.min(1, S.holdMs / PRO_STALL(v))})`
    if (me.current) { halt(me.current); me.current.style.transform = at2(MX, 66 + Math.min(1, S.depth) * 18) }
    if (him.current) { halt(him.current); him.current.style.transform = at2(MX, 56 + Math.min(1, S.depth) * 18) }
    if (S.depth >= 1) { settle('sack', 'WALKED BACK'); return false }
    if (S.holdMs >= PRO_STALL(v)) { S.q = 1 - S.depth * 0.5; settle('clean', 'ANCHORED'); return false }
  }, anchor)
  useKeys({ ArrowLeft: e => slide(-1, e), ArrowRight: e => slide(1, e), a: e => slide(-1, e), d: e => slide(1, e), ' ': punchDown, ArrowUp: punchDown }, { ' ': punchUp, ArrowUp: punchUp })
  const arrow = cue?.side ? <IconCaret dir={cue.side < 0 ? 'left' : 'right'} size={14} /> : null
  return (
    <div className="mg-play mg-play--lanes mg-play--pro">
      <div className="mg-box">
        <Fx r={fx} />
        <div className={`mg-rush${cue?.side ? ` is-${cue.side < 0 ? 'L' : 'R'}` : ''}`}><i>{cue ? (cue.side < 0 ? <>{arrow} {cue.word}</> : cue.side > 0 ? <>{cue.word} {arrow}</> : cue.word) : `SNAP ${i + 1} OF ${plan.snaps.length}`}</i></div>
      </div>
      <div className="mg-court mg-court--pro" aria-hidden="true">
        <span className="mg-pro-los" /><span className="mg-pro-qb" />
        <span className="mg-pt" ref={two} style={{ transform: at2(MX, -20), opacity: 0 }}><span className="mg-dot is-d" /></span>
        <span className="mg-pt" ref={him} style={{ transform: at2(MX + s * 9, 36) }}><span className="mg-dot is-d" /></span>
        <span className="mg-pt" ref={me} style={{ transform: at2(MX, 66) }}><span className="mg-dot is-me" />{ring && <span className="mg-pro-ring" ref={ringEl} />}</span>
      </div>
      <div className="mg-seal-prog mg-pro-hold" ref={holdEl} style={{ visibility: anchor ? 'visible' : 'hidden' }}><span /><i>ANCHOR · HOLD PUNCH</i></div>
      <div className="mg-sides mg-sides--pro">
        <button className="mg-side" ref={el => { btns.current[-1] = el }} onPointerDown={e => slide(-1, e)}><IconCaret dir="left" size={14} /> {s < 0 ? 'OUTSIDE' : 'INSIDE'}<Fl /></button>
        <button className="mg-side mg-side--punch" ref={el => { btns.current.P = el }} onPointerDown={primary(punchDown)} onPointerUp={punchUp} onPointerCancel={punchUp} onPointerLeave={punchUp}>PUNCH<Kbd k="SPACE" /><Fl /></button>
        <button className="mg-side" ref={el => { btns.current[1] = el }} onPointerDown={e => slide(1, e)}>{s > 0 ? 'OUTSIDE' : 'INSIDE'} <IconCaret dir="right" size={14} /><Fl /></button>
      </div>
      <Dots n={plan.snaps.length} of={scores} />
    </div>
  )
}

// ── Fast Break: the last man commits, hit the man he leaves ─────────────────
// Three breaks, each quicker. First a two on one (him and a wing), then three on two: a trailer
// sprints back into one lane, then the last man commits to another, the ball or a wing. The third
// lane is open: a wing gets the pass, the middle is yours to finish. Move before he commits and he
// jumps it.
const FB_X = [16, 50, 84], FB_CALLS = ['LEFT', 'FINISH', 'RIGHT']
const FB_COMMIT = [[26, 40], [50, 47], [74, 40]]
function FastBreak({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => [0, 1, 2].map(k => {
    const delay = (850 + r() * 550) * (1 - k * 0.12), pace = 1 - k * 0.09
    if (k === 0) { const wing = r() < 0.5 ? 0 : 2, commit = r() < 0.5 ? 1 : wing; return { delay, pace, lanes: [1, wing], trail: null, commit, open: commit === 1 ? wing : 1 } }
    const trail = Math.floor(r() * 3), commit = (trail + 1 + Math.floor(r() * 2)) % 3
    return { delay, pace, lanes: [0, 1, 2], trail, commit, open: 3 - trail - commit }
  }), [r])
  const [i, setI] = useState(0)
  const [scores, setScores] = useState([])
  const R = useRef({ at: 0, T: 0, done: false })
  const outs = useRef(0), reads = useRef(0), men = useRef([]), last = useRef(null), trail = useRef(null), ball = useRef(null), btns = useRef([]), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const p = plan[i]
  useLayoutEffect(() => {
    const T = reactMs(v) * 0.84 * p.pace + 150, t0 = now(), at = t0 + p.delay, run = p.delay + T
    R.current = { at, T, done: false }
    // the break: everyone running up the floor (the wings a step ahead), the ball in his hands
    ;[0, 1, 2].forEach(k => {
      const el = men.current[k]; if (!el) return
      el.style.visibility = p.lanes.includes(k) ? '' : 'hidden'
      const y0 = k === 1 ? 96 : 90
      el.style.transform = ''; glide(el, [{ transform: at2(FB_X[k], y0) }, { transform: at2(FB_X[k], y0 - 34) }], run, t0)
    })
    if (ball.current) { ball.current.style.transform = ''; glide(ball.current, [{ transform: at2(54, 91) }, { transform: at2(54, 57) }], run, t0) }
    // the trailer comes from behind into his lane; the last man waits at the rim, then commits
    if (trail.current) {
      trail.current.style.visibility = p.trail == null ? 'hidden' : ''
      if (p.trail != null) { const y = p.trail === 1 ? 66 : 60; trail.current.style.transform = ''; glide(trail.current, [{ transform: at2(FB_X[p.trail] + (p.trail === 1 ? -7 : 0), 116) }, { transform: at2(FB_X[p.trail] + (p.trail === 1 ? -7 : 0), y) }], run, t0, { easing: 'ease-out' }) }
    }
    if (last.current) { const [cx, cy] = FB_COMMIT[p.commit]; last.current.style.transform = ''; glide(last.current, [{ transform: at2(50, 22), easing: 'ease-out' }, { transform: at2(cx, cy) }], 220, at) }
    const t = setTimeout(() => { outs.current++; settle(0, 'TOO SLOW') }, at + T + 60 - now())
    return () => clearTimeout(t)
  }, [i]) // eslint-disable-line
  const settle = (s, word, k = null, how = null) => {
    const S = R.current
    if (S.done) return
    S.done = true
    ;[...men.current, last.current, trail.current, ball.current].forEach(el => el && freeze(el))
    if (k != null) flash(btns.current[k], s ? 'hit' : 'miss')
    if (s) {
      if (k === 1) { moveTo(men.current[1], 50, 17, 340); moveTo(ball.current, 50, 9, 360, 'ease-in') }
      else {
        const m = spot(men.current[k])
        moveTo(ball.current, m.x + 4, m.y - 4, 150)
        moveTo(men.current[k], k === 0 ? 40 : 60, 17, 420)
        later(() => moveTo(ball.current, 50, 9, 260, 'ease-in'), 170)
      }
      say(fx.current, k === 1 ? (s >= 0.85 ? 'AND ONE' : 'LAYUP') : s >= 0.85 ? 'DIME' : 'ASSIST', 'hit'); good(s >= 0.85)
    } else {
      if (how === 'steal') { const d = spot(k === p.commit ? last.current : trail.current); moveTo(ball.current, d.x + 3, d.y - 3, 170) }
      else if (how === 'jump') { moveTo(last.current, FB_COMMIT[k][0], FB_COMMIT[k][1] + 6, 200); moveTo(ball.current, FB_COMMIT[k][0] + 3, FB_COMMIT[k][1] + 3, 210) }
      else if (how === 'out') moveTo(ball.current, k === 0 ? -8 : 108, 62, 280, 'ease-in')
      if (k != null && k !== p.open) flash(btns.current[p.open], 'hit')
      say(fx.current, word, 'miss'); bad()
    }
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length, avg = next.reduce((a, b) => a + b, 0) / plan.length, hit = made >= 2
      later(() => end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: `${made} of 3 breaks scored${reads.current ? ` · ${reads.current} jumped early` : ''}`, out: outs.current > 0 && outs.current >= 3 - made, raw: { made, of: 3 } }), 350)
    } else later(() => setI(i + 1), 850)
  }
  const pick = (k, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (ts < S.at) { reads.current++; return settle(0, 'TELEGRAPHED', k, 'jump') }
    if (k !== p.open) {
      if (!p.lanes.includes(k)) return settle(0, 'NOBODY THERE', k, 'out')
      return settle(0, k === 1 ? (p.trail === 1 ? 'CHASED DOWN' : 'CHARGE') : 'PICKED OFF', k, 'steal')
    }
    settle(clamp(1 - Math.max(0, ts - S.at - REACT_FLOOR) / (S.T - REACT_FLOOR), 0.4, 1), null, k)
  }
  useKeys({ 1: e => pick(0, e), 2: e => pick(1, e), 3: e => pick(2, e), ArrowLeft: e => pick(0, e), ArrowUp: e => pick(1, e), ArrowDown: e => pick(1, e), ArrowRight: e => pick(2, e) })
  return (
    <div className="mg-play mg-play--targets mg-play--break">
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-court mg-court--break" aria-hidden="true">
          <span className="mg-court-arc" /><span className="mg-court-paint" /><span className="mg-court-rim" />
          <i className="mg-court-tag">{p.trail == null ? '2 ON 1' : '3 ON 2'}</i>
          {[0, 1, 2].map(k => <span key={k} className="mg-pt" ref={el => { men.current[k] = el }}><span className={`mg-dot ${k === 1 ? 'is-me' : 'is-mate'}`} /></span>)}
          <span className="mg-pt" ref={trail}><span className="mg-dot is-d" /></span>
          <span className="mg-pt" ref={last}><span className="mg-dot is-d" /></span>
          <span className="mg-pt" ref={ball}><span className="mg-dot is-ball" /></span>
        </div>
      </div>
      <div className="mg-targets mg-gaps">{FB_CALLS.map((c, k) => <button key={c} ref={el => { btns.current[k] = el }} className={`mg-target mg-gap${p.lanes.includes(k) ? '' : ' is-empty'}`} onPointerDown={e => pick(k, e)} aria-label={k === 1 ? 'Finish' : `Pass ${c.toLowerCase()}`}><b>{c}</b><Kbd k={k + 1} /><Fl /></button>)}</div>
      <Hint>HIT THE MAN HE LEAVES</Hint>
      <Dots n={3} of={scores} />
    </div>
  )
}

// ── Alley-Oop: meet it at the top, then throw it down ───────────────────────
// Three lobs from the wing, each a touch quicker. The jump takes him a beat to get up, so it's a
// read of the ball's flight: tap to leave the floor so his peak meets it at the spot. A clean catch
// and he hangs there with it: tap again to throw it down before he comes back to earth. The higher
// he met it, the longer he hangs. Two of three down wins it.
const oopPt = u => ({ x: 8 + 55 * u, y: 66 - 147 * u + 105 * u * u })   // the lob: the wing to the spot (u = 1) and on
const OOP_ARC = Array.from({ length: 26 }, (_, k) => { const u = k * 0.05, q = oopPt(u); return { transform: at2(q.x, q.y), offset: u / 1.25 } })
const OOP_X = 62, OOP_FLOOR = 84, OOP_TOP = 31, OOP_RISE = 400, OOP_HANG = 80
function Oop({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => [0, 1, 2].map(k => ({ delay: 750 + r() * 650, flight: [1150, 1010, 900][k] * (0.94 + r() * 0.12) })), [r])
  const W = (75 + v * 9) * 0.85                 // ms either side of the ball at the spot
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState('wait')    // wait → air → slam
  const [scores, setScores] = useState([])
  const R = useRef({ launch: 0, arrive: 0, jumped: false, caught: false, miss: false, q1: 0, S: 0, done: false })
  const outs = useRef(0), posters = useRef(0), me = useRef(null), ball = useRef(null), rim = useRef(null), btn = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const p = plan[i], launch = now() + p.delay, arrive = launch + p.flight
    const S = { launch, arrive, jumped: false, caught: false, miss: false, q1: 0, S: 0, done: false }
    R.current = S
    setPhase('wait')
    if (me.current) { halt(me.current); me.current.style.transform = at2(OOP_X, OOP_FLOOR) }
    if (ball.current) { ball.current.style.transform = ''; glide(ball.current, OOP_ARC, p.flight * 1.25, launch) }
    const ts = [
      setTimeout(() => sfx('tap'), p.delay),
      // never left the floor: it sails over him
      setTimeout(() => { if (!S.jumped) { outs.current++; settle(0, 'TOO LATE', 'late') } }, arrive + 80 - now()),
    ]
    return () => ts.forEach(clearTimeout)
  }, [i]) // eslint-disable-line
  const grab = S => {
    if (S !== R.current || S.caught || S.done) return
    S.caught = true
    const m = freeze(me.current)                 // he hangs up there with it
    halt(ball.current); if (ball.current) ball.current.style.transform = at2(m.x + 2, m.y - 6)
    S.S = (340 + v * 24) * (0.75 + 0.45 * S.q1)
    setPhase('slam'); haptic('medium')
    later(() => { if (S === R.current && !S.done) { outs.current++; settle(0, 'NO FINISH', 'drop') } }, S.S + 40)
  }
  const settle = (s, word, how) => {
    const S = R.current
    if (S.done) return
    S.done = true
    if (s) {
      moveTo(me.current, 69, 40, 130)
      moveTo(ball.current, 73.5, 47, 130, 'ease-in')
      later(() => {
        moveTo(ball.current, 73.5, 70, 220, 'ease-in'); moveTo(me.current, 68, OOP_FLOOR, 420, 'ease-in')
        if (!reduced()) rim.current?.animate?.([{ transform: 'translateY(0)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(-1px)' }, { transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' })
      }, 135)
      flash(btn.current, 'hit')
      const poster = s >= 0.85; if (poster) posters.current++
      say(fx.current, poster ? 'POSTER' : 'SLAM', 'hit'); sfx('stamp'); haptic('heavy')
    } else {
      // he comes down; the ball falls off the rim (or out of his hands)
      if (how === 'drop' || how === 'fumble') { moveTo(me.current, OOP_X, OOP_FLOOR, 380, 'ease-in'); moveTo(ball.current, 70, 92, 460, 'ease-in') }
      else later(() => moveTo(ball.current, 86, 92, 420, 'ease-in'), 230)
      flash(btn.current, 'miss'); say(fx.current, word, 'miss'); bad()
    }
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length, avg = next.reduce((a, b) => a + b, 0) / plan.length, hit = made >= 2
      later(() => end({ score: hit ? Math.max(avg, 0.5) : Math.min(avg, 0.45), hit, note: `${made} of 3 thrown down${posters.current ? ` · ${posters.current} poster${posters.current > 1 ? 's' : ''}` : ''}`, out: outs.current > 0 && outs.current >= 3 - made, raw: { made, of: 3 } }), 450)
    } else later(() => setI(i + 1), 900)
  }
  const press = e => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (!S.jumped) {
      // up: his peak (the middle of the hang) is where the ball has to be
      S.jumped = true; setPhase('air'); haptic('light')
      const total = OOP_RISE * 2 + OOP_HANG
      glide(me.current, [{ transform: at2(OOP_X, OOP_FLOOR), easing: EASE_OUT2 }, { transform: at2(OOP_X, OOP_TOP), offset: OOP_RISE / total }, { transform: at2(OOP_X, OOP_TOP), offset: (OOP_RISE + OOP_HANG) / total, easing: EASE_IN2 }, { transform: at2(OOP_X, OOP_FLOOR) }], total, ts)
      const err = ts + OOP_RISE + OOP_HANG / 2 - S.arrive
      if (Math.abs(err) > W) { S.miss = true; later(() => { if (S === R.current) settle(0, err < 0 ? 'TOO EARLY' : 'TOO LATE', 'whiff') }, Math.max(0, S.arrive - now() + 40)); return }
      S.q1 = 0.4 + 0.6 * clamp(1 - Math.abs(err) / W, 0, 1)
      later(() => grab(S), Math.max(0, S.arrive - now()))
      return
    }
    if (S.miss) return
    // the throw down: not before he has it
    if (ts < S.arrive - 40) return settle(0, 'FUMBLED', 'fumble')
    if (!S.caught) grab(S)
    const dt = Math.max(0, ts - S.arrive)
    if (dt > S.S) return
    const q2 = clamp(1 - Math.max(0, dt - 255) / Math.max(1, S.S - 255), 0.4, 1)
    settle(clamp(0.45 * S.q1 + 0.55 * q2, 0.5, 1), null, 'slam')
  }
  useKeys({ ' ': press, Enter: press })
  return (
    <div className="mg-play mg-play--oop">
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-court mg-oop" aria-hidden="true">
          <span className="mg-oop-floor" /><span className="mg-oop-board" /><span className="mg-oop-net" /><span className="mg-oop-rim" ref={rim} />
          <span className="mg-oop-spot" />
          <i className="mg-court-tag">LOB {i + 1} OF 3</i><i className="mg-oop-wing">WING</i>
          <span className="mg-pt" style={{ transform: at2(7, 76) }}><span className="mg-dot is-mate" /></span>
          <span className="mg-pt" ref={me} style={{ transform: at2(OOP_X, OOP_FLOOR) }}><span className="mg-dot is-me" /></span>
          <span className="mg-pt" ref={ball}><span className="mg-dot is-ball" /></span>
        </div>
      </div>
      <button className={`mg-foot mg-push${phase === 'slam' ? ' is-slam' : ''}`} ref={btn} onPointerDown={primary(press)} aria-label={phase === 'slam' ? 'Slam' : 'Jump'}>{phase === 'slam' ? 'SLAM' : 'JUMP'}<Kbd k="SPACE" /><Fl /></button>
      <Hint>{phase === 'slam' ? 'THROW IT DOWN' : 'MEET IT AT THE TOP'}</Hint>
      <Dots n={3} of={scores} />
    </div>
  )
}

// ═══ The combine ═══════════════════════════════════════════════════════════
// ── 40-yard dash: hold for the gun, then alternate feet as fast as possible ──
// The time on the board is the official one, on the player's own scale (a B-speed QB runs about a
// 4.80, a B-speed receiver a 4.48: lib/mg/combineNorms): a clean, quick go at his grade runs his
// target; slower feet, a slow start or a stumble cost hundredths. It's what Career records.
function Dash({ v, seed, onDone, unit = 'YDS', dist = 40, game = 'forty', pos = null, label = null }) {
  const r = useRng(seed)
  const [phase, setPhase] = useState('set')          // set → go
  const [flag, setFlag] = useState(null)              // 'false start' message
  const S = useRef({ go: false, goAt: 0, yards: 0, last: null, taps: 0, stumbles: 0, falses: 0, first: 0, done: false })
  const runner = useRef(null), yd = useRef(null), gun = useRef(null), feet = useRef({}), fx = useRef(null), callEl = useRef(null)
  const [end] = useOnce(onDone)
  const stride = (1.0 + v * 0.055) * dist / 40        // a faster player covers more ground a step
  // the gun: a random wait, so it can't be timed (a false start resets it)
  const arm = () => { clearTimeout(gun.current); gun.current = setTimeout(() => { S.current.go = true; S.current.goAt = now(); setPhase('go'); sfx('whistle'); haptic('medium') }, 900 + r() * 1500) }
  useEffect(() => { arm(); return () => clearTimeout(gun.current) }, []) // eslint-disable-line
  // give up after 10 seconds of running
  useEffect(() => { if (phase !== 'go') return; const t = setTimeout(() => finish(now()), 10000); return () => clearTimeout(t) }, [phase]) // eslint-disable-line
  const sprint = game === 'sprint'
  const target = dashTarget(game, pos ?? (sprint ? 'guard' : game === 'sprint30' ? 'st' : 'wr'), v)
  // a quick, clean go at this grade: a good start and about 8 steps a second
  const ref = 0.26 + Math.ceil(dist / stride) / 8
  const finish = at => {
    const s = S.current; if (s.done) return; s.done = true
    const real = (at - s.goAt) / 1000, through = s.yards >= dist
    const react = s.first ? (s.first - s.goAt) / 1000 : 1
    const off = through ? clamp((real - ref) * (sprint ? 0.16 : 0.22), -0.1, 0.9) : 1.2
    const secs = Math.round((target + off + s.falses * 0.04 + Math.min(0.1, s.stumbles * 0.02)) * 100) / 100
    const score = clamp(0.6 + (target + 0.1 - secs) / 0.25, 0, 1), hit = score >= 0.5
    if (callEl.current) callEl.current.textContent = secs.toFixed(2)
    say(fx.current, through ? (score >= 0.85 ? 'BURNER' : hit ? 'GOOD RUN' : 'SLOW') : 'TIME', hit ? 'hit' : 'miss')
    const how = `${through ? (react < 0.25 ? 'Great jump' : react < 0.45 ? 'Clean start' : 'Slow start') : 'Pulled up'}${s.falses ? ' · false start' : ''}${s.stumbles ? ` · ${s.stumbles} stumble${s.stumbles > 1 ? 's' : ''}` : ''}`
    end({ score, hit, note: `${secs.toFixed(2)}s · ${how}`, raw: { secs }, stat: { label: label ?? (sprint ? '3/4-COURT SPRINT' : '40-YARD DASH'), value: secs.toFixed(2), unit: 'SEC', verdict: score >= 0.85 ? 'BURNER' : hit ? 'GOOD TIME' : 'SLOW TIME', sub: how } })
  }
  const foot = (side, e) => {
    const s = S.current
    if (s.done) return
    const ts = pressAt(e)
    if (!s.go || ts < s.goAt) {
      if (s.falses < 2) { s.falses++; flash(feet.current[side], 'miss'); say(fx.current, 'FALSE START', 'miss'); setFlag(s.falses > 1 ? 'LAST WARNING' : null); sfx('deny'); haptic('heavy'); arm() }
      return
    }
    if (!s.first) s.first = ts
    s.taps++
    if (side === s.last) { s.stumbles++; s.yards += stride * 0.25; haptic('light'); flash(feet.current[side], 'miss'); say(fx.current, 'STUMBLE', 'miss') }
    else { s.yards += stride; flash(feet.current[side], 'hit') }
    s.last = side
    const y = Math.min(dist, s.yards)
    if (runner.current) runner.current.style.transform = `translate3d(${(y / dist) * 100}%,0,0)`
    if (yd.current) yd.current.textContent = `${Math.round(y)} ${unit}`
    if (s.yards >= dist) { good(true); finish(ts) }
  }
  useKeys({ ArrowLeft: e => foot('L', e), ArrowRight: e => foot('R', e), f: e => foot('L', e), j: e => foot('R', e) })
  return (
    <div className="mg-play mg-play--dash">
      <div className="mg-box">
        <Fx r={fx} />
        <span ref={callEl} className={`mg-call-out${phase === 'go' ? ' is-go' : ''}`}>{phase === 'set' ? (flag ? `SET · ${flag}` : 'SET') : 'GO'}</span>
      </div>
      <div className="mg-lane"><span className="mg-runner-track" ref={runner}><span className="mg-runner" /></span><span className="mg-goal" /></div>
      <span className="mg-hint mg-yds" ref={yd}>0 {unit}</span>
      <div className="mg-feet">
        <button className="mg-foot" ref={el => { feet.current.L = el }} onPointerDown={e => foot('L', e)} aria-label="Left foot">LEFT<Kbd k="←" /><Fl /></button>
        <button className="mg-foot" ref={el => { feet.current.R = el }} onPointerDown={e => foot('R', e)} aria-label="Right foot">RIGHT<Kbd k="→" /><Fl /></button>
      </div>
      <Hint>ON GO · LEFT, RIGHT, LEFT…</Hint>
    </div>
  )
}
// ── QB sneak: the cadence teases (one to three HUTs, then the snap), then a pile to push ──
// Jump the snap and it's offside (once is a warning). After it, every press pushes the pile and the
// pile pushes back: momentum leaks away, so it takes a steady hammering, not a few taps. Size and
// legs are the push. Over the line inside the time and it's a first down.
const SNEAK_MS = 3000
function Sneak({ v, seed, onDone }) {
  const r = useRng(seed)
  const [call, setCall] = useState('SET')
  const [live, setLive] = useState(false)
  const S = useRef({ snapAt: 0, live: false, done: false, m: 0, vel: 0, last: 0, first: 0, taps: 0, offside: 0, peak: 0 })
  const pile = useRef(null), fill = useRef(null), btn = useRef(null), fx = useRef(null), t = useRef([])
  const [end] = useOnce(onDone)
  const push = (0.08 + v * 0.006) * 0.88    // one press, by size and legs
  const leak = (0.47 - v * 0.018) * 1.12   // how fast the pile takes it back, a second (an average grade needs about 7 presses a second)
  const later = (fn, ms) => { const id = setTimeout(fn, ms); t.current.push(id) }
  useEffect(() => () => t.current.forEach(clearTimeout), [])
  // the cadence: SET, then one to three HUTs at an uneven beat, then the snap
  const cadence = () => {
    t.current.forEach(clearTimeout); t.current = []
    const huts = 1 + Math.floor(r() * 3)
    let at = 650
    setCall('SET')
    for (let k = 0; k < huts; k++) {
      later(() => { setCall(k === 0 ? 'HUT' : `HUT ${'· HUT '.repeat(k).trim()}`); sfx('tap') }, at)
      at += 480 + r() * 420
    }
    later(() => { const s = S.current; s.live = true; s.snapAt = now(); setLive(true); setCall('HIKE'); sfx('whistle'); haptic('medium') }, at + r() * 250)
  }
  useEffect(() => { cadence() }, []) // eslint-disable-line
  const finish = (made, at) => {
    const s = S.current; if (s.done) return; s.done = true; s.live = false; setLive(false)
    const secs = made ? (at - s.snapAt) / 1000 : SNEAK_MS / 1000
    const jump = s.first ? (s.first - s.snapAt) / 1000 : 1
    const score = made ? clamp(1 - (secs - 1.2) / 2.2, 0.55, 1) : clamp(s.peak * 0.45, 0, 0.45)
    if (made) { say(fx.current, score >= 0.85 ? 'PUNCHED IT IN' : 'FIRST DOWN', 'hit'); flash(btn.current, 'hit'); good(score >= 0.85) }
    else { say(fx.current, 'STOPPED', 'miss'); bad() }
    end({ score, hit: made, note: made ? `Over in ${secs.toFixed(1)}s · ${jump < 0.25 ? 'great get-off' : jump < 0.45 ? 'good get-off' : 'slow get-off'}` : s.offside > 1 ? 'Offside twice.' : `Stopped short · ${Math.round(s.peak * 100)}% of the way` })
  }
  // the pile: momentum leaks away every frame; the meter is how far he's got
  useLoop(ts => {
    const s = S.current
    if (!s.live) return
    const dt = Math.min(50, ts - (s.last || ts)) / 1000; s.last = ts
    s.m = clamp(s.m - leak * dt * (0.3 + s.m * 0.5), 0, 1)
    s.peak = Math.max(s.peak, s.m)
    if (pile.current) pile.current.style.transform = `translate3d(${s.m * 100}%,0,0)`
    if (fill.current) fill.current.style.transform = `scaleX(${s.m})`
    if (ts - s.snapAt > SNEAK_MS) { finish(false, ts); return false }
  }, live)
  const press = e => {
    const s = S.current
    if (s.done) return
    const ts = pressAt(e)
    if (!s.live || ts < s.snapAt) {
      s.offside++
      flash(btn.current, 'miss'); bad()
      if (s.offside > 1) { say(fx.current, 'OFFSIDE', 'miss'); finish(false, ts); return }
      say(fx.current, 'FALSE START', 'miss'); setCall('SET'); cadence()
      return
    }
    if (!s.first) { s.first = ts; if (ts - s.snapAt < 250) { s.m += push * 0.8; say(fx.current, 'GET-OFF', 'hit') } }
    s.taps++
    s.m = Math.min(1, s.m + push * (1 - s.m * 0.25))
    flash(btn.current, 'hit'); haptic('light')
    if (s.m >= 1) finish(true, ts)
  }
  useKeys({ ' ': press, Enter: press })
  return (
    <div className="mg-play mg-play--dash mg-play--sneak">
      <div className="mg-box">
        <Fx r={fx} />
        <span className={`mg-call-out${live ? ' is-go' : ''}`}>{call}</span>
      </div>
      <div className="mg-lane mg-pile"><span className="mg-pile-fill" ref={fill} /><span className="mg-runner-track" ref={pile}><span className="mg-runner" /></span><span className="mg-goal" /></div>
      <button className="mg-foot mg-push" ref={btn} onPointerDown={press} aria-label="Push">PUSH<Kbd k="SPACE" /><Fl /></button>
      <Hint>{live ? 'HAMMER IT' : 'WAIT FOR THE SNAP'}</Hint>
    </div>
  )
}
// ── Two-minute drill: a real drive against a real clock ──────────────────────
// Down six, 75 yards to go, 1:20 on the clock, no timeouts. Every snap: pick a play, then hit its
// throw window. The out gets out of bounds (little ground, stops the clock), the slant moves the
// chains but the clock runs, the deep shot is the big gain in the tightest window. A miss is
// incomplete (the clock stops); a bad miss on the deep shot can be picked. Spike it to stop the
// clock for a down. Four downs to gain ten, a first down for every ten. In the end zone, it's won.
const DRIVE_PLAYS = [
  { id: 'out', label: 'SIDELINE OUT', sub: 'Short · stops the clock', mult: 1.2, yds: [6, 11], secs: 6, oob: true },
  { id: 'slant', label: 'SLANT', sub: 'Moves the chains · clock runs', mult: 1.05, yds: [9, 16], secs: 17 },
  { id: 'deep', label: 'DEEP SHOT', sub: 'Big gain · tight window', mult: 0.62, yds: [22, 38], secs: 9, pick: 0.34 },
]
const DRIVE_START = 80, DRIVE_YARDS = 75
const clockText = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`
function Drive({ v, seed, onDone }) {
  const r = useRng(seed)
  const [st, setSt] = useState({ clock: DRIVE_START + Math.round(v * 1.5), ball: 25, down: 1, togo: 10, play: null, log: [] })
  const [phase, setPhase] = useState('call')        // call → throw → (next call, or over)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  const fx = useRef(null), btns = useRef([]), busy = useRef(false)
  const play = st.play && DRIVE_PLAYS.find(p => p.id === st.play)
  const toGoal = 100 - st.ball
  const finish = (won, s, note) => {
    const left = Math.max(0, s.clock)
    const score = won ? clamp(0.6 + left / 60, 0.6, 1) : clamp(((s.ball - 25) / DRIVE_YARDS) * 0.45, 0, 0.45)
    later(() => end({ score, hit: won, note }), 650)
  }
  // a snap's result: yards, clock, downs, and whether the drive goes on
  const resolve = (s, p, j) => {
    let { clock, ball, down, togo } = s
    let word = j.word, tone = j.hit ? 'hit' : 'miss', over = null
    if (p.id === 'spike') { clock -= 2; down++; word = 'SPIKED'; tone = 'hit' }
    else if (j.hit) {
      const gain = Math.round(p.yds[0] + (p.yds[1] - p.yds[0]) * (0.35 + 0.65 * j.q) * (0.8 + r() * 0.4))
      ball += gain; clock -= p.secs + Math.round(r() * 3)
      if (ball >= 100) { over = 'td'; word = 'TOUCHDOWN' }
      else { word = `+${gain}`; togo -= gain; if (togo <= 0) { down = 1; togo = Math.min(10, 100 - ball); word = `+${gain} · FIRST DOWN` } else down++ }
    } else {
      clock -= 5; down++
      if (p.pick && j.q === 0 && Math.abs(j.miss) > 1.25 && r() < p.pick) { over = 'pick'; word = 'INTERCEPTED' }
      else word = 'INCOMPLETE'
    }
    if (!over && clock <= 0) over = 'clock'
    if (!over && down > 4) over = 'downs'
    return { next: { clock, ball: Math.min(100, ball), down, togo, play: null, log: [...s.log, tone] }, word, tone, over }
  }
  const after = (res) => {
    say(fx.current, res.word, res.tone)
    res.tone === 'hit' ? good(res.over === 'td') : bad()
    setSt(res.next)
    if (res.over) {
      setPhase('over')
      const why = { td: `Touchdown with ${clockText(Math.max(0, res.next.clock))} left`, pick: 'Picked off on the deep shot.', clock: `Time ran out on the ${100 - res.next.ball <= 50 ? `${100 - res.next.ball}` : `own ${res.next.ball}`}.`, downs: 'Turned it over on downs.' }[res.over]
      finish(res.over === 'td', res.next, why)
      return
    }
    busy.current = true
    later(() => { busy.current = false; setPhase('call') }, 600)
  }
  const call = (k, e) => {
    if (busy.current || ended.current || phase !== 'call') return
    if (k === 3) {   // spike
      if (st.down >= 4) return
      flash(btns.current[3], 'hit'); after(resolve(st, { id: 'spike' }, {}))
      return
    }
    const p = DRIVE_PLAYS[k]; if (!p) return
    flash(btns.current[k], 'hit'); sfx('tap')
    setSt(s => ({ ...s, play: p.id })); setPhase('throw')
  }
  const thrown = j => { if (busy.current || ended.current || phase !== 'throw' || !play) return; after(resolve(st, play, j)) }
  useKeys({ 1: e => call(0, e), 2: e => call(1, e), 3: e => call(2, e), 4: e => call(3, e), s: e => call(3, e) })
  const down = ['1ST', '2ND', '3RD', '4TH'][Math.min(3, st.down - 1)]
  const spot = st.ball >= 50 ? `THEIR ${100 - st.ball}` : `OWN ${st.ball}`
  return (
    <div className="mg-play mg-play--drive">
      <div className="mg-drive-board">
        <b className={st.clock <= 20 ? 'is-late' : ''}>{clockText(Math.max(0, st.clock))}</b>
        <span>{down} & {toGoal <= st.togo ? 'GOAL' : st.togo}</span>
        <span>{spot}</span>
      </div>
      <div className="mg-lane mg-drive-field" aria-hidden="true">
        <span className="mg-drive-chains" style={{ left: `${Math.min(100, st.ball + st.togo)}%` }} />
        <span className="mg-runner-track" style={{ transform: `translateX(${st.ball}%)` }}><span className="mg-runner" /></span>
        <span className="mg-goal" />
      </div>
      {phase === 'throw' && play ? (
        <DriveThrow key={st.log.length} v={v} seed={`${seed}-${st.log.length}`} play={play} fx={fx} onThrow={thrown} />
      ) : (
        <>
          <div className="mg-box mg-drive-fx"><Fx r={fx} /></div>
          <div className="mg-calls">
            {DRIVE_PLAYS.map((p, k) => (
              <button key={p.id} ref={el => { btns.current[k] = el }} className="mg-call" disabled={phase !== 'call'} onPointerDown={e => call(k, e)}>
                <Kbd k={k + 1} /><span className="mg-call-txt">{p.label}<small>{p.sub}</small></span><Fl />
              </button>
            ))}
            <button ref={el => { btns.current[3] = el }} className="mg-call mg-call--spike" disabled={phase !== 'call' || st.down >= 4} onPointerDown={e => call(3, e)}>
              <Kbd k={4} /><span className="mg-call-txt">SPIKE IT<small>Stops the clock · costs a down</small></span><Fl />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
function DriveThrow({ v, seed, play, fx, onThrow }) {
  const r = useRng(seed)
  const zone = useMemo(() => 30 + r() * 40, [r])
  const width = zw(v) * play.mult
  const mark = useRef(null), zoneEl = useRef(null), sent = useRef(false)
  const speed = useMemo(() => (play.id === 'deep' ? 1.82 : 1.56) + r() * 0.16, [r, play.id])
  const { at, dir, stop } = useSweep(mark, speed)
  const tap = e => {
    if (sent.current) return
    sent.current = true
    const ts = pressAt(e), p100 = at(ts) * 100, j = judgeBar(p100, zone, width, dir(ts))
    j.miss = Math.abs(p100 - zone) / Math.max(1, width / 2)
    stop(p100); flash(zoneEl.current, j.hit ? 'hit' : 'miss')
    onThrow(j)
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-drive-throw" onPointerDown={primary(tap)}>
      <Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={zone} width={width} label={play.label} />
      <Hint touch="TAP" desk="SPACE">TO THROW</Hint>
    </div>
  )
}
// ── Throwing velocity / max vertical: the Advanced game's peak meter, in the DOM ──
// (lib/mg/meter.js's velo and vert, same numbers.) Hold: the needle climbs a stack of blocks that
// heat up toward the top, quicker and quicker (x²), touches the gold PEAK cap and falls back the same
// way. Let go at the peak: the closer, the faster the throw (the higher the jump). The green band is
// the top of the stack, and a stronger arm makes it bigger. Three reps, two in the green pass; the
// radar (the Vertec) reads every rep and the best one is the official number.
const HEAT = ['#c9d2d8', '#d4d6c4', '#e0d9ae', '#ebdc92', '#f4dc74', '#f8d158', '#fbc145', '#fdae39', '#fe9a31', '#fe862d', '#fd722b', '#fb5f2b', '#f84d2c', '#f33e2e']
const PEAK_UP = [{ easing: EASE_IN2 }, { offset: 0.5, easing: EASE_OUT2 }, {}]
const peakFrames = (a, b) => PEAK_UP.map((k, i) => ({ ...k, transform: `translate3d(0,${i === 1 ? b : a},0)` }))
const FLINCH = 90                 // a tap this short isn't a rep: the finger slipped
function Velo({ v, seed, onDone, noun = 'THROW' }) {
  const jump = noun !== 'THROW'
  const r = useRng(seed)
  const t = clamp(v, 0, 11) / 11, tv = clamp((v - 1) / 10, 0, 1)
  const half = (28 + 40 * tv ** 1.35) * 0.85                  // ms either side of the peak that's green
  const ups = useMemo(() => [0, 1, 2].map(() => 680 + r() * 220), [r])   // ms from the press to the peak
  const [k, setK] = useState(0)
  const [reps, setReps] = useState([])
  const repsR = useRef([])
  const [held, setHeld] = useState(false)
  const H = useRef({ held: false, at: 0, id: null, busy: false, k: 0, full: 0 })
  const needle = useRef(null), lit = useRef(null), litIn = useRef(null), fx = useRef(null)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  const pOf = (c, tau) => clamp(1 - Math.abs(tau - c) / c, 0, 1) ** 2
  const lo = pOf(ups[k], ups[k] - half)                         // the green starts here
  const place = p => {
    halt(needle.current); halt(lit.current); halt(litIn.current)
    if (needle.current) needle.current.style.transform = `translate3d(0,${-p * 100}%,0)`
    if (lit.current) lit.current.style.transform = `translate3d(0,${(1 - p) * 100}%,0)`
    if (litIn.current) litIn.current.style.transform = `translate3d(0,${-(1 - p) * 100}%,0)`
  }
  const settle = tau => {
    const h = H.current; if (!h.held) return
    h.held = false; h.busy = true; clearTimeout(h.full); setHeld(false)
    const c = ups[h.k], off = tau - c, a = Math.abs(off), inZone = a <= half
    const q = inZone ? 1 - 0.4 * (a / half) : clamp(0.5 - (0.5 * (a - half)) / (half * 1.2 + 60), 0, 0.5)
    const val = jump ? clamp(Math.round((26 + t * 16 + (q - 0.6) * 7) * 10) / 10, 20, 46) : clamp(Math.round(48 + t * 12 + (q - 0.6) * 6), 44, 64)
    const p = pOf(c, Math.min(tau, 2 * c))
    place(p)
    say(fx.current, inZone ? (q > 0.86 ? 'PEAK' : 'GOOD') : off < 0 ? 'EARLY' : 'LATE', inZone ? 'hit' : 'miss')
    haptic(inZone ? 'medium' : 'light')
    // the radar reads it when the ball gets to the net (the Vertec when he gets to the top)
    later(() => {
      sfx(inZone ? 'stamp' : 'tap')
      const next = [...repsR.current, { q, inZone, val, p, early: off < 0 }]
      repsR.current = next; setReps(next)
      {
        if (next.length >= 3) {
          const best = Math.max(...next.map(x => x.val)), made = next.filter(x => x.inZone).length, hit = made >= 2
          const bestQ = Math.max(...next.map(x => x.q))
          const label = jump ? 'MAX VERTICAL' : 'THROWING VELOCITY', unit = jump ? 'INCHES' : 'MPH'
          later(() => end({ score: bestQ, hit, note: `${best}${jump ? '"' : ' mph'} · ${made} of 3 in the green`, raw: jump ? { inches: best, clean: made } : { mph: best, clean: made },
            stat: { label, value: String(best), unit, verdict: hit ? (jump ? 'GOOD JUMP' : 'GOOD ARM') : 'MISTIMED', sub: `${made} of 3 in the green` } }), 350)
        } else later(() => { h.busy = false; h.k += 1; setK(h.k); place(0) }, 650)
      }
    }, jump ? 340 : 260)
  }
  const down = e => {
    const h = H.current
    if (h.held || h.busy || ended.current) return
    if (e?.pointerId != null) { h.id = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId) } catch {} } else h.id = null
    h.held = true; h.at = pressAt(e); setHeld(true); haptic('light')
    const c = ups[h.k], ms = 2 * c
    ;[needle.current, lit.current, litIn.current].forEach(el => { if (el) el.style.transform = '' })
    glide(needle.current, peakFrames('0', '-100%'), ms, h.at, { fill: 'forwards' })
    glide(lit.current, peakFrames('100%', '0'), ms, h.at, { fill: 'forwards' })
    glide(litIn.current, peakFrames('-100%', '0'), ms, h.at, { fill: 'forwards' })
    // held all the way back down: it goes as it is
    h.full = setTimeout(() => settle(ms), Math.max(0, h.at + ms - now()))
  }
  const up = e => {
    const h = H.current
    if (!h.held || (e?.pointerId != null && h.id != null && e.pointerId !== h.id)) return
    const tau = pressAt(e) - h.at
    if (tau < FLINCH) { h.held = false; clearTimeout(h.full); setHeld(false); place(0); return }
    settle(tau)
  }
  useEffect(() => () => clearTimeout(H.current.full), [])
  useKeys({ ' ': down }, { ' ': up })
  const lastRep = reps[reps.length - 1], best = reps.length ? Math.max(...reps.map(x => x.val)) : null
  const blocks = litOn => HEAT.map((c, i) => {
    const band = (i + 1) / HEAT.length > lo + 0.01
    return <i key={i} className={band ? 'is-band' : ''} style={{ background: litOn ? (band ? '#35e07a' : c) : undefined }} />
  })
  return (
    <div className="mg-play mg-play--power mg-play--velo" onPointerDown={primary(down)} onPointerUp={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()}>
      <div className="mg-box mg-velo">
        <Fx r={fx} />
        <div className="mg-vm">
          <span className="mg-vm-cap">PEAK</span>
          <div className="mg-vm-stack">
            <div className="mg-vm-clip">
              <div className="mg-vm-blocks">{blocks(false)}</div>
              <div className="mg-vm-lit" ref={lit}><div className="mg-vm-blocks" ref={litIn}>{blocks(true)}</div></div>
            </div>
            {reps.map((m, i) => <span key={i} className={`mg-vm-mark${m.early ? ' is-early' : ''}${m.inZone ? ' is-in' : ''}`} style={{ bottom: `${m.p * 100}%` }} />)}
            <span className="mg-vm-track" ref={needle}><i className="mg-vm-needle" /></span>
          </div>
        </div>
        <div className="mg-radar" aria-live="polite">
          <span className="mg-radar-lbl">{jump ? 'VERTEC' : 'RADAR'}</span>
          <b className={lastRep ? (lastRep.inZone ? 'is-in' : '') : 'is-idle'}>{lastRep ? lastRep.val : '--'}</b>
          <span className="mg-radar-unit">{jump ? 'INCHES' : 'MPH'}</span>
          <span className="mg-radar-reps">{[0, 1, 2].map(i => <em key={i} className={reps[i] ? (reps[i].val === best ? 'is-best' : reps[i].inZone ? 'is-in' : 'is-out') : ''}>{reps[i]?.val ?? '–'}</em>)}</span>
        </div>
      </div>
      {held ? <Hint>LET GO AT THE PEAK</Hint> : <Hint touch="HOLD" desk="HOLD SPACE">{jump ? 'TO LOAD' : 'TO WIND UP'} · {Math.min(3, k + 1)} OF 3</Hint>}
      <Dots n={3} of={reps.map(m => m.inZone)} />
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
  const rad = (4 + v * 0.5) * 0.85                              // the zone's half-width in % of the field (3.8–8.1)
  const tall = hoop ? 0.6 : 1                                   // its height against its width (the rim is flat)
  const [i, setI] = useState(0)
  const [axis, setAxis] = useState('x')
  const [scores, setScores] = useState([])
  const [shot, setShot] = useState(null)
  const A = useRef({ t0: now(), axis: 'x', X: 50, live: true })
  const lx = useRef(null), ly = useRef(null), fx = useRef(null)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  const speed = 1.1 + i * 0.23
  // where the live line is at any moment (the across line, then the up–down one a little quicker)
  const posAt = ts => tri(Math.max(0, ts - A.current.t0) / 1000 * speed * (A.current.axis === 'y' ? 1.15 : 1)) * 100
  // (each line glides on the compositor from its own start, at the speed posAt() reads)
  useEffect(() => { if (lx.current) { lx.current.style.transform = ''; glide(lx.current, SWEEP, 2000 / speed, A.current.t0, { iterations: Infinity }) } }, [i]) // eslint-disable-line
  useEffect(() => { if (axis === 'y' && ly.current && A.current.live) { ly.current.style.transform = ''; glide(ly.current, SWEEP_Y, 2000 / (speed * 1.15), A.current.t0, { iterations: Infinity }) } }, [axis, i]) // eslint-disable-line
  const tap = e => {
    const a = A.current
    if (!a.live || ended.current) return
    const ts = pressAt(e), p = posAt(ts)
    if (a.axis === 'x') {
      a.X = p; a.axis = 'y'; a.t0 = ts
      halt(lx.current); if (lx.current) lx.current.style.transform = `translate3d(${p}%,0,0)`
      haptic('light'); setAxis('y'); return
    }
    a.live = false
    halt(ly.current); if (ly.current) ly.current.style.transform = `translate3d(0,${p}%,0)`
    const n = nets[i], X = a.X, Y = p
    // how far off, in zone radii (the field is 5:3, so a % down is 0.6 of a % across)
    const dx = (X - n.x) / rad, dy = ((Y - n.y) * 0.6) / (rad * tall)
    const d = Math.hypot(dx, dy)
    const s = d <= 1 ? clamp(1 - d * 0.5, 0.5, 1) : 0
    say(fx.current, s ? (hoop ? (s >= 0.85 ? 'SWISH' : 'GOOD') : grade(s)) : Math.abs(dx) > Math.abs(dy) ? (hoop ? 'OFF THE RIM' : 'WIDE') : Y < n.y ? (hoop ? 'LONG' : 'HIGH') : (hoop ? 'SHORT' : 'LOW'), s ? 'hit' : 'miss')
    if (hoop) sfx(s ? 'make' : 'rimmiss')
    s ? good(s >= 0.85) : bad()
    setShot({ x: X, y: Y, hit: !!s })
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= nets.length) {
      const made = next.filter(Boolean).length, sc = next.reduce((x, y) => x + y, 0) / nets.length
      end({ score: sc, hit: sc >= 0.5, note: `${made} of ${nets.length} ${hoop ? 'made' : 'in the hands'}`, raw: { made, of: nets.length },
        stat: { label: hoop ? 'SPOT-UP SHOOTING' : 'ACCURACY', value: `${made}/${nets.length}`, unit: hoop ? 'MADE' : 'ON TARGET', verdict: sc >= 0.5 ? (made === nets.length ? 'PERFECT ROUND' : 'GOOD ROUND') : 'COLD ROUND', sub: `Shooting score ${Math.round(sc * 100)}` } })
      return
    }
    later(() => { A.current = { t0: now(), axis: 'x', X: 50, live: true }; setI(i + 1); setAxis('x'); setShot(null) }, 500)
  }
  useKeys({ ' ': tap, Enter: tap })
  const n = nets[i]
  return (
    <div className="mg-play mg-play--aim" onPointerDown={primary(tap)}>
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-field">
          <span className={`mg-aimat mg-aimat--${hoop ? 'hoop' : 'hands'}`} style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${rad * 2}%` }}>{hoop ? HOOP : HANDS}</span>
          <span className={`mg-line-x${axis === 'x' && !shot ? ' is-live' : ''}`} ref={lx} />
          {axis === 'y' && <span className={`mg-line-y${!shot ? ' is-live' : ''}`} ref={ly} />}
          {shot && <span className={`mg-ball${shot.hit ? ' is-hit' : ''}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />}
        </div>
      </div>
      <Hint touch="TAP" desk="SPACE">{axis === 'x' ? 'TO LOCK LEFT–RIGHT' : hoop ? 'TO LOCK THE ARC' : 'TO LOCK UP–DOWN'} · {i + 1} OF {nets.length}</Hint>
      <Dots n={nets.length} of={scores} />
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
const at3 = p => `translate3d(${p.x}cqw, ${p.y * 0.6}cqw, 0)`
function Routes({ v, onDone }) {
  const [i, setI] = useState(0)
  const [scores, setScores] = useState([])
  const [thrown, setThrown] = useState(null)        // { hit, note }
  const rcv = useRef(null), ball = useRef(null), fx = useRef(null), noThrow = useRef(0)
  const st = useRef({ t0: now() + 900, threw: false })
  const [end] = useOnce(onDone)
  const later = useTimers()
  const rt = ROUTES[i]
  const quick = 1 - i * 0.08                        // each route a little quicker
  const secs = rt.secs * quick
  const half = (0.07 + (v / 11) * 0.09) * 0.82      // how long the target stretch lasts (in route fractions), from Accuracy
  const finish = s => {
    const next = [...scores, s]
    later(() => {
      setScores(next)
      if (i + 1 >= ROUTES.length) {
        const made = next.filter(Boolean).length, sc = next.reduce((a, b) => a + b, 0) / ROUTES.length
        end({ score: sc, hit: made >= 3, note: `${made} of ${ROUTES.length} on target`, raw: { made, of: ROUTES.length },
          stat: { label: 'ACCURACY DRILL', value: String(Math.round(sc * 100)), unit: 'OF 100', verdict: made >= 3 ? (made === ROUTES.length ? 'ALL FOUR ON TARGET' : 'ON TARGET') : 'OFF TARGET', sub: `${made} of ${ROUTES.length} on target` } })
      } else later(() => { setI(i + 1); setThrown(null); halt(ball.current) }, 450)
    }, rt.air * quick * 1000)
  }
  // a beat before the snap so the route can be read; he lines up, then runs it on the compositor
  // (keyframes at each break, spaced by distance: the same path routeAt() reads)
  useEffect(() => {
    const t0 = now() + 900
    st.current = { t0, threw: false }
    const seg = rt.pts.slice(1).map((p, k) => Math.hypot(p[0] - rt.pts[k][0], p[1] - rt.pts[k][1])), total = seg.reduce((a, b) => a + b, 0)
    let d = 0
    const frames = rt.pts.map((p, k) => { if (k) d += seg[k - 1]; return { transform: at3({ x: p[0], y: p[1] }), offset: d / total } })
    if (rcv.current) { rcv.current.style.transform = ''; glide(rcv.current, frames, secs * 1000, t0) }
    // never thrown: the route runs out
    noThrow.current = setTimeout(() => {
      if (st.current.threw) return
      st.current.threw = true; bad(); say(fx.current, 'NO THROW', 'miss'); setThrown({ hit: false, note: 'NO THROW' }); finish(0)
    }, t0 + secs * 1080 - now())
    return () => clearTimeout(noThrow.current)
  }, [i]) // eslint-disable-line
  const tap = e => {
    if (st.current.threw) return
    const ts = pressAt(e)
    if (ts < st.current.t0) return
    st.current.threw = true; clearTimeout(noThrow.current)
    const u0 = ((ts - st.current.t0) / 1000) / secs
    const uArr = u0 + (rt.air * quick) / secs          // where he'll be when it gets there
    const at = routeAt(rt.pts, uArr)
    const d = Math.abs(uArr - rt.open) / half
    const s = d <= 1 ? clamp(1 - d * 0.5, 0.5, 1) : 0
    // a drill word: there's nobody covering him, only a spot to hit
    const note = s ? (s >= 0.85 ? 'BULLSEYE' : 'ON TARGET') : uArr < rt.open ? 'OFF TARGET · SHORT' : 'OFF TARGET · LONG'
    // the ball is away on the press (the Web Animations API: no layout read to restart it)
    ball.current?.animate?.([{ transform: at3(QB_SPOT) }, { transform: at3(at) }], { duration: rt.air * quick * 1000, easing: 'cubic-bezier(.3,.1,.5,1)', fill: 'forwards' })
    sfx('swoosh'); haptic('light')
    later(() => { if (s) { sfx('catchball'); haptic(s >= 0.85 ? 'medium' : 'light') } else bad(); say(fx.current, note, s ? 'hit' : 'miss'); setThrown({ hit: !!s, note }) }, rt.air * quick * 1000)
    finish(s)
  }
  useKeys({ ' ': tap, Enter: tap })
  // the route drawn, its open stretch brighter
  const path = rt.pts.map(p => `${p[0]},${p[1] * 0.6}`).join(' ')
  const openPts = [rt.open - half, rt.open - half / 2, rt.open, rt.open + half / 2, rt.open + half].map(u => routeAt(rt.pts, u)).map(p => `${p.x},${p.y * 0.6}`).join(' ')
  return (
    <div className="mg-play mg-play--routes" onPointerDown={primary(tap)}>
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-field mg-field--routes">
          <svg className="mg-routes-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="43.2" x2="100" y2="43.2" className="mg-los" />
            <polyline points={path} className="mg-route" />
            <polyline points={openPts} className="mg-route-open" />
          </svg>
          <span className="mg-qb" style={{ transform: at3(QB_SPOT) }}>QB</span>
          <span className="mg-wr" ref={rcv} style={{ transform: at3({ x: rt.pts[0][0], y: rt.pts[0][1] }) }} />
          <span className={`mg-fb${thrown ? (thrown.hit ? ' is-hit' : ' is-miss') : ''}`} ref={ball} style={{ transform: at3(QB_SPOT) }} />
        </div>
      </div>
      <Hint touch="TAP" desk="SPACE">TO THROW · {rt.name} · {i + 1} OF {ROUTES.length}</Hint>
      <Dots n={ROUTES.length} of={scores} />
    </div>
  )
}
// ── 3-cone: six calls, each a direction; react before the window shuts ──────
const DIRS = ['up', 'left', 'right', 'down']
// The official time: the drill's real-world range at this grade (as Career reads it), each slip a
// stumble round a cone, quick clean cuts the hundredths under it
function Cone({ v, seed, onDone, lane = false, pos = null }) {
  const r = useRng(seed)
  const plan = useMemo(() => Array.from({ length: 6 }, () => ({ gap: 250 + r() * 400, dir: Math.floor(r() * 4) })), [r])
  const [i, setI] = useState(0)
  const [cue, setCue] = useState(null)
  const [scores, setScores] = useState([])
  const R = useRef({ cue: null, at: 0, done: false })
  const outs = useRef(0), btns = useRef([]), fx = useRef(null)
  const [end] = useOnce(onDone)
  const T = (480 + v * 42) * 0.85 * Math.pow(0.92, i)
  const officialSecs = (made, of, score) => {
    const t = clamp(v, 0, 11) / 11, run = score - 0.6, slips = of - made
    const s = lane ? 11.9 - t * 1.4 + slips * 0.12 - run * 0.15 : 7.45 + coneShift(pos) - t * 0.75 + slips * 0.07 - run * 0.08
    return Math.round(s * 100) / 100
  }
  useEffect(() => {
    setCue(null); R.current = { cue: null, at: 0, done: false }
    const t1 = setTimeout(() => { R.current.cue = plan[i].dir; R.current.at = now(); setCue(plan[i].dir) }, plan[i].gap)
    const t2 = setTimeout(() => { if (!R.current.done) outs.current++; settle(0, 'TOO SLOW') }, plan[i].gap + T)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = (s, word, k = null) => {
    if (R.current.done) return
    R.current.done = true
    if (k != null) flash(btns.current[k], s ? 'hit' : 'miss')
    say(fx.current, s ? grade(s) : word, s ? 'hit' : 'miss')
    s ? good(s >= 0.85) : bad()
    const next = [...scores, s]
    setScores(next)
    // clean cuts are the drill (70%); how quick they were adds the rest. All six clean is never a fail.
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length
      const quickness = made ? next.filter(Boolean).reduce((a, b) => a + b, 0) / made : 0
      const score = (made / plan.length) * 0.7 + quickness * 0.3 * (made / plan.length)
      const secs = officialSecs(made, plan.length, score), hit = made >= plan.length - 1
      end({ score, hit, note: `${secs.toFixed(2)}s · ${made} of ${plan.length} clean cuts`, out: outs.current > 0 && outs.current >= plan.length - made, raw: { made, of: plan.length, secs },
        stat: { label: lane ? 'LANE AGILITY' : '3-CONE DRILL', value: secs.toFixed(2), unit: 'SEC', verdict: hit ? (made === plan.length ? 'CLEAN RUN' : 'GOOD TIME') : 'SLIPPED', sub: `${made} of ${plan.length} clean cuts` } })
    }
    else setI(i + 1)
  }
  const go = (d, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (S.cue == null || ts < S.at) { settle(0, 'EARLY', d); return }
    settle(d === S.cue ? clamp(1 - (ts - S.at) / T * 0.6, 0.4, 1) : 0, 'WRONG WAY', d)
  }
  useKeys({ ArrowUp: e => go(0, e), ArrowLeft: e => go(1, e), ArrowRight: e => go(2, e), ArrowDown: e => go(3, e), w: e => go(0, e), a: e => go(1, e), d: e => go(2, e), s: e => go(3, e) })
  return (
    <div className="mg-play mg-play--cone">
      <div className="mg-box">
        <Fx r={fx} />
        <span className={`mg-cue${cue != null ? ' is-on' : ''}`}>{cue != null ? <IconCaret dir={DIRS[cue]} size={44} /> : <i className="mg-cue-wait" />}</span>
      </div>
      <div className="mg-pad">{DIRS.map((id, k) => <button key={id} ref={el => { btns.current[k] = el }} className={`mg-dir mg-dir--${id}`} onPointerDown={e => go(k, e)} aria-label={id}><IconCaret dir={id} size={20} /><Fl /></button>)}</div>
      <Hint touch="TAP" desk="ARROWS">THE WAY IT POINTS</Hint>
      <Dots n={plan.length} of={scores} />
    </div>
  )
}
// ── Gauntlet: balls down two lanes, faster and overlapping; catch in the zone ─
function Gauntlet({ v, seed, onDone }) {
  const r = useRng(seed)
  const N = 7
  // left, right, left...: each ball the other side of the last, on a mildly uneven beat (never a metronome)
  const balls = useMemo(() => {
    let t = 0.5; const first = r() < 0.5 ? 0 : 1
    return Array.from({ length: N }, (_, k) => { const b = { lane: (first + k) % 2, at: t, dur: (1.15 - k * 0.07) * 0.9 }; t += (0.72 - k * 0.05) * (0.84 + r() * 0.32); return b })
  }, [r])
  const zone = (9 + v * 1.1) * 0.85                             // the catch zone's height, % of the lane (from the bottom)
  const st = useRef(balls.map(() => null))                      // null = in the air, number = score
  const els = useRef([]), shown = useRef([]), zones = useRef([]), fx = useRef(null)
  const [, force] = useState(0)
  const [end] = useOnce(onDone)
  const T0 = useRef(now())
  const posOf = (b, t) => (t - b.at) / b.dur * 100            // 0 = top, 100 = bottom
  // each ball falls on the compositor, a straight line from its own start (the same line posOf()
  // reads), shown only while it's in the air; the loop below only checks for drops
  // (each ball rides a lane-tall track, so a % move is a % of the lane: no measuring)
  useEffect(() => {
    balls.forEach((b, k) => {
      const el = els.current[k]; if (!el) return
      glide(el, [{ transform: 'translate3d(0,0,0)', visibility: 'visible' }, { transform: 'translate3d(0,110%,0)', visibility: 'visible' }], b.dur * 1100, T0.current + b.at * 1000, { fill: 'none' })
    })
  }, []) // eslint-disable-line
  useLoop(ts => {
    const t = (ts - T0.current) / 1000
    let changed = false
    balls.forEach((b, k) => {
      if (st.current[k] == null && posOf(b, t) > 100 + zone * 0.3) { st.current[k] = 0; changed = true; halt(els.current[k]); bad(); say(fx.current, 'DROPPED', 'miss'); flash(zones.current[b.lane], 'miss') }
    })
    if (changed) force(x => x + 1)
    if (st.current.every(x => x != null)) {
      const caught = st.current.filter(Boolean).length, sc = st.current.reduce((a, b) => a + b, 0) / N, hit = caught >= 5
      end({ score: sc, hit, note: `${caught} of ${N} caught`, raw: { made: caught, of: N },
        stat: { label: 'GAUNTLET', value: `${caught}/${N}`, unit: 'CAUGHT', verdict: hit ? (caught === N ? 'CLEAN RUN' : 'GOOD HANDS') : 'DROPS', sub: `Catch score ${Math.round(sc * 100)}` } })
      return false
    }
  })
  // judged at the moment of the press (the event's own time)
  const grab = (lane, e) => {
    if (st.current.every(x => x != null)) return
    const t = (pressAt(e) - T0.current) / 1000
    // the lowest ball in the air in this lane
    let best = -1, bp = -1
    balls.forEach((b, k) => { const p = posOf(b, t); if (b.lane === lane && st.current[k] == null && p >= 0 && p > bp) { best = k; bp = p } })
    if (best < 0) { flash(zones.current[lane], 'miss'); return }
    const d = Math.abs(bp - (100 - zone / 2))
    const s = d <= zone / 2 + 5 ? clamp(1 - d / zone, 0.5, 1) : 0   // a little past the zone counts: a screen and a mouse add their own delay
    st.current[best] = s
    halt(els.current[best])
    flash(zones.current[lane], s ? 'hit' : 'miss'); say(fx.current, s ? grade(s) : bp < 100 - zone ? 'EARLY' : 'LATE', s ? 'hit' : 'miss')
    if (s) sfx('catchball')
    s ? good(s >= 0.85) : bad()
    force(x => x + 1)
  }
  useKeys({ ArrowLeft: e => grab(0, e), ArrowRight: e => grab(1, e), f: e => grab(0, e), j: e => grab(1, e) })
  return (
    <div className="mg-play mg-play--gauntlet">
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-lanes">
          {[0, 1].map(l => (
            <div key={l} className="mg-glane">
              <span className="mg-gzone" ref={el => { zones.current[l] = el }} style={{ height: `${zone}%` }}><Fl /></span>
              {balls.map((b, k) => b.lane === l && <span key={k} className="mg-gtrack" ref={el => { els.current[k] = el }}><span className="mg-gball" /></span>)}
            </div>
          ))}
        </div>
      </div>
      <div className="mg-sides"><button className="mg-side" onPointerDown={e => grab(0, e)}><IconCaret dir="left" size={14} /> CATCH</button><button className="mg-side" onPointerDown={e => grab(1, e)}>CATCH <IconCaret dir="right" size={14} /></button></div>
      <span className="mg-dots">{balls.map((_, k) => <i key={k} className={st.current[k] != null ? (st.current[k] ? 'is-hit' : 'is-miss') : ''} />)}</span>
    </div>
  )
}
// ── Bench press: drive the bar up against gravity, as many reps as you can ──
function Bench({ v, load = 1, onDone }) {
  const S = useRef({ h: 0, reps: 0, end: 0, done: false })
  const bar = useRef(null), count = useRef(null), secs = useRef(null), lock = useRef(null), fx = useRef(null)
  const [end] = useOnce(onDone)
  // Realistic numbers: strength sets how many reps the set can hold (football: the 225 lb
  // combine bar, about 18 for the weakest to 35 for the strongest; basketball (load < 1): the
  // 185 lb bar, about 3 to 22), and the bar fails the way a real set does: every rep near that
  // ceiling lifts less and sinks faster, so fast tapping gets you close to it, never past it
  const ceil = load < 1 ? 1 + v * 1.9 : 16 + v * 1.7   // basketball: the weakest can put up 1-3 (Kevin Durant did 0), the best about 22
  const fail = () => Math.min(0.97, (S.current.reps / ceil) ** 2.2)
  const push = 34 * (1 + v * 0.06) * load * 0.92
  const SECS = 12
  useEffect(() => { S.current.end = now() + SECS * 1000 }, [])
  useLoop(t => {
    const s = S.current; if (s.done) return false
    const dt = Math.min(0.05, Math.max(0, t - (s.last ?? t)) / 1000); s.last = t
    const left = (s.end - t) / 1000
    // the bar sinks between taps, faster as the arms give out
    s.h = Math.max(0, s.h - (30 + fail() * 70) * dt)
    if (bar.current) bar.current.style.transform = `translate3d(0,${-s.h}%,0)`
    const shown = Math.max(0, left).toFixed(1); if (secs.current && secs.current.textContent !== shown) secs.current.textContent = shown
    if (left <= 0) {
      s.done = true
      const reps = s.reps, lo = ceil * 0.35
      // judged against what this player can lift: most of his ceiling is a great set
      const hit = reps >= ceil * 0.68
      end({ score: clamp((reps - lo) / (ceil - lo), 0, 1), hit, note: `${reps} reps`, raw: { reps },
        stat: { label: `BENCH PRESS · ${load < 1 ? 185 : 225} LB`, value: String(reps), unit: reps === 1 ? 'REP' : 'REPS', verdict: hit ? (reps >= ceil * 0.9 ? 'STRONG SET' : 'GOOD SET') : 'GASSED', sub: '' } })
      return false
    }
  })
  const tap = () => {
    const s = S.current; if (s.done) return
    s.h += push * (1 - fail())
    if (s.h >= 100) { s.h = 0; s.reps++; good(false); flash(lock.current, 'hit'); say(fx.current, `${s.reps}`, 'hit'); if (count.current) count.current.textContent = `${s.reps} REPS` }
    if (bar.current) bar.current.style.transform = `translate3d(0,${-s.h}%,0)`
  }
  useKeys({ ' ': tap, Enter: tap })
  return (
    <div className="mg-play mg-play--bench" onPointerDown={primary(tap)}>
      <span className="mg-secs" ref={secs}>{SECS.toFixed(1)}</span>
      <div className="mg-box mg-box--meter">
        <Fx r={fx} />
        <div className="mg-rack"><span className="mg-lockout" ref={lock}><Fl /></span><span className="mg-barbell-track" ref={bar}><span className="mg-barbell" /></span></div>
      </div>
      <span className="mg-hint mg-reps" ref={count}>0 REPS</span>
      <Hint touch="TAP FAST" desk="SPACE, FAST">TO LOCK IT OUT</Hint>
    </div>
  )
}

// ═══ Soccer: the striker's moments and the academy trial ═══════════════════════
// The same calls as the Advanced games (lib/mg/penalty.js and the rest), on a small pitch: a goal at the top,
// dots for the men. Every move is a Web Animation (glide / moveTo); presses are judged at their own timestamp.
const SOC_LANE = { '-1': 36, 0: 50, 1: 64 }
const sideOf = k => (k < 0 ? 'L' : k > 0 ? 'R' : 'C')
function PitchTop({ children, tag = null, className = '' }) {
  return (
    <div className={`mg-court mg-pitch ${className}`} aria-hidden="true">
      <span className="mg-pitch-box" /><span className="mg-pitch-six" /><span className="mg-pitch-goal" /><span className="mg-pitch-spot" />
      {tag && <i className="mg-court-tag">{tag}</i>}
      {children}
    </div>
  )
}
const SocBtn = ({ refFn, onPress, k, children }) => <button className="mg-side" ref={refFn} onPointerDown={primary(onPress)}>{children}{k && <Kbd k={k} />}<Fl /></button>

// ── Penalty: pick your spot as the run-up ends; wait on the keeper and send him the wrong way ──
function Pen({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => ({ stay: r() < 0.18, guess: r() < 0.5 ? -1 : 1, dive: -470 + r() * 470, read: r(), run: 800 + r() * 500 }), [r])
  const late = 160 + (clamp(v, 1, 11) - 1) * 40, readP = 0.72 - (clamp(v, 1, 11) - 1) * 0.042
  const S = useRef({ run: 0, strike: 0, dive: 0, kgoes: 0, dived: false, pressed: null, read: false, done: false, stut: false })
  const [phase, setPhase] = useState('set')
  const [early, setEarly] = useState(false)
  const keeper = useRef(null), ballEl = useRef(null), fill = useRef(null), fx = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const t0 = now(), run = t0 + plan.run, strike = run + 1100, dive = strike + plan.dive
    S.current = { run, strike, dive, kgoes: plan.stay ? 0 : plan.guess, dived: false, pressed: null, read: false, done: false }
    if (fill.current) { fill.current.style.transform = 'scaleX(0)'; glide(fill.current, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 1100, run, { fill: 'forwards' }) }
    const ts = [
      setTimeout(() => { setPhase('run'); sfx('whistle') }, Math.max(0, plan.run - 380)),
      setTimeout(() => { const s = S.current; if (s.done) return; s.dived = true; if (s.kgoes) moveTo(keeper.current, SOC_LANE[s.kgoes] + s.kgoes * 6, 16, 300) }, dive - now()),
      setTimeout(() => { if (S.current.pressed == null && !S.current.done) strike(0, true) }, strike + late - now()),
    ]
    return () => ts.forEach(clearTimeout)
  }, []) // eslint-disable-line
  const strike = (k, stutter) => {
    const s = S.current
    if (s.done) return
    s.done = true
    const K = s.kgoes
    let goal, why
    if (stutter) { goal = false; why = 'Stuttered and scuffed it' }
    else if (k === 0) { goal = K !== 0; why = goal ? 'Down the middle' : 'Straight at him' }
    else if (K === -k) { goal = true; why = s.read ? 'Went the other way' : 'Sent him the wrong way' }
    else if (K === k) { goal = false; why = s.read ? 'He read it' : 'Guessed right' }
    else { goal = (s.q ?? 0.8) >= 0.86 - (clamp(v, 1, 11) - 1) * 0.016; why = goal ? 'Tucked it in the corner' : 'He stayed big' }
    if (!s.dived && K) moveTo(keeper.current, SOC_LANE[K] + K * 6, 16, 260)
    moveTo(ballEl.current, stutter ? 50 : SOC_LANE[k] + k * 8, goal ? 8 : 18, 380, 'ease-in')
    if (!stutter) flash(btns.current[sideOf(k)], goal ? 'hit' : 'miss')
    later(() => {
      say(fx.current, goal ? 'GOAL' : 'SAVED', goal ? 'hit' : 'miss'); if (goal) { sfx('stamp'); haptic('heavy') } else bad()
      const q = s.q ?? 0.2
      later(() => end({ score: goal ? clamp(0.6 + 0.4 * q, 0, 1) : clamp(0.12 + 0.2 * q, 0, 0.45), hit: goal, note: why }), 450)
    }, 380)
  }
  const press = (k, e) => {
    const s = S.current
    if (s.done || s.pressed != null || phase !== 'run') return
    const ts = pressAt(e)
    if (ts < s.run) return
    s.pressed = ts
    // shown him your hips before he's gone: he reads it, often
    if (!s.dived && ts < s.dive - 60 && plan.read < readP) { s.kgoes = k; s.read = true }
    s.q = ts <= s.strike - 620 ? 0.74 : ts <= s.strike ? 0.78 + 0.22 * (ts - (s.strike - 620)) / 620 : 1 - 0.2 * (ts - s.strike) / late
    haptic('light')
    later(() => strike(k, false), Math.max(0, s.strike - now()))
  }
  // the stutter: a check in the run-up. A keeper who's guessing goes early on it (most of them), and you see which way
  const stutter = e => {
    const s = S.current
    if (s.done || s.stut || s.pressed != null || phase !== 'run' || pressAt(e) < s.run) return
    s.stut = true; haptic('light')
    if (!plan.stay && plan.read > 0.3 && !s.dived) { s.dived = true; setEarly(true); moveTo(keeper.current, SOC_LANE[s.kgoes] + s.kgoes * 6, 16, 300) }
  }
  useKeys({ ArrowLeft: e => press(-1, e), ArrowUp: e => press(0, e), ArrowRight: e => press(1, e), a: e => press(-1, e), w: e => press(0, e), d: e => press(1, e), e: stutter, E: stutter })
  return (
    <div className="mg-play mg-play--soc">
      <div className="mg-box"><Fx r={fx} /><div className="mg-runup"><span ref={fill} /><i>{phase === 'set' ? 'WAIT FOR THE WHISTLE' : early ? 'HE’S GONE EARLY' : 'RUN-UP'}</i></div></div>
      <PitchTop tag="PENALTY">
        <span className="mg-pt" ref={keeper} style={{ transform: at2(50, 16) }}><span className="mg-dot is-gk" /></span>
        <span className="mg-pt" style={{ transform: at2(46, 86) }}><span className="mg-dot is-me" /></span>
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(50, 74) }}><span className="mg-dot is-sball" /></span>
      </PitchTop>
      <div className="mg-sides mg-sides--three">
        <SocBtn refFn={el => { btns.current.L = el }} onPress={e => press(-1, e)} k="←">LEFT</SocBtn>
        <SocBtn refFn={el => { btns.current.C = el }} onPress={e => press(0, e)} k="↑">MIDDLE</SocBtn>
        <SocBtn refFn={el => { btns.current.R = el }} onPress={e => press(1, e)} k="→">RIGHT</SocBtn>
      </div>
      <div className="mg-sides mg-sides--one"><SocBtn refFn={el => { btns.current.ST = el }} onPress={stutter} k="E">STUTTER</SocBtn></div>
      <Hint>PICK A CORNER · STUTTER AND THE KEEPER MIGHT GO EARLY</Hint>
    </div>
  )
}

// ── One-on-One: shoot while he's on the move, or wait for him to go down and round him ──
const OO_WORD = { line: 'ON HIS LINE', out: 'ON THE MOVE', set: 'SET', down: 'DOWN' }
function OneOne({ v, seed, onDone }) {
  const r = useRng(seed)
  const t = (clamp(v, 1, 11) - 1) / 10
  const plan = useMemo(() => ({ m1: 550 + r() * 300, s1: 300 + r() * 200, m2: 520 + r() * 200, s2: 260 + r() * 180, kside: r() < 0.5 ? -1 : 1, roll: r() }), [r])
  const runMs = 3500 - t * 700, outAt = 500, downAt = runMs * 0.8, roundMs = 400 + t * 460, catchAt = 1800 + t * 2600
  const S = useRef({ t0: 0, done: false })
  const [state, setState] = useState('line')
  const me = useRef(null), gk = useRef(null), def = useRef(null), ballEl = useRef(null), fx = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  const stateAt = el => {
    if (el < outAt) return 'line'
    if (el >= downAt) return 'down'
    let a = el - outAt
    for (const [st, d] of [['out', plan.m1], ['set', plan.s1], ['out', plan.m2], ['set', plan.s2]]) { if (a < d) return st; a -= d }
    return 'out'
  }
  useLayoutEffect(() => {
    const t0 = now() + 500
    S.current = { t0, done: false }
    glide(me.current, [{ transform: at2(46, 92) }, { transform: at2(48, 30) }], runMs, t0, { fill: 'forwards', easing: 'linear' })
    glide(def.current, [{ transform: at2(36, 99) }, { transform: at2(46, 30) }], runMs * 0.97, t0, { fill: 'forwards', easing: 'ease-in' })
    glide(gk.current, [{ transform: at2(50, 12), offset: 0 }, { transform: at2(50, 12), offset: outAt / downAt }, { transform: at2(49, 26), offset: 1 }], downAt, t0, { fill: 'forwards' })
    let raf = 0
    const tick = () => {
      const s = S.current
      if (s.done) return
      const el = now() - t0
      setState(stateAt(el))
      if (el >= catchAt && el < downAt) return settle(false, 'The defender got a foot in', 'TACKLED')
      if (el >= downAt + roundMs) return settle(false, 'Keeper smothers it at his feet', 'SMOTHERED')
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line
  useEffect(() => { if (state === 'down') moveTo(gk.current, 49 + plan.kside * 10, 28, 300) }, [state]) // eslint-disable-line
  const settle = (goal, why, word, k = null) => {
    const s = S.current
    if (s.done) return
    s.done = true
    ;[me, def, gk].forEach(x => freeze(x.current))
    if (k != null) flash(btns.current[sideOf(k)], goal ? 'hit' : 'miss')
    if (goal) moveTo(ballEl.current, 50 + (k ? -plan.kside * 6 : (plan.roll < 0.5 ? -8 : 8)), 6, 360, 'ease-in')
    say(fx.current, word, goal ? 'hit' : 'miss'); if (goal) { sfx('stamp'); haptic('heavy') } else bad()
    later(() => end({ score: goal ? 0.78 : 0.2, hit: goal, note: why }), 650)
  }
  const press = (k, e) => {
    const s = S.current
    if (s.done || !s.t0) return
    const el = pressAt(e) - s.t0, st = stateAt(el)
    if (el < 0) return
    if (el >= catchAt && st !== 'down') return settle(false, 'The defender got a foot in', 'TACKLED', k)
    if (k === 0) {
      if (st === 'down') return el - downAt <= roundMs * 0.5 && plan.roll < 0.6 + t * 0.35 ? settle(true, 'Lifted it over him', 'GOAL', 0) : settle(false, 'He got down and smothered it', 'SAVED', 0)
      if (st === 'set') return plan.roll < (0.08 + t * 0.32) ? settle(true, 'Picked his spot past him', 'GOAL', 0) : settle(false, 'He was set and saved it', 'SAVED', 0)
      if (el < outAt + plan.m1 * 0.3) return settle(false, 'Dragged it wide from distance', 'WIDE', 0)
      if (el > downAt - 380) return settle(false, 'He came out and made himself big', 'SAVED', 0)
      return plan.roll < 0.5 + t * 0.44 ? settle(true, 'Hit it before he was set', 'GOAL', 0) : settle(false, 'Good save, at full stretch', 'SAVED', 0)
    }
    if (el < downAt - 1100) return     // (nothing to take on yet)
    if (st !== 'down') return settle(false, 'Went too early: he stayed on his feet', 'TOO EARLY', k)
    if (k === plan.kside) return settle(false, 'Took it the way he was diving', 'SAVED', k)
    settle(true, 'Took it round the keeper', 'GOAL', k)
  }
  // the dink: over a keeper who's come off his line (on the move toward you, or down); a keeper on his line takes it
  const chip = e => {
    const s = S.current
    if (s.done || !s.t0) return
    const el = pressAt(e) - s.t0, st = stateAt(el)
    if (el < 0) return
    if (el >= catchAt && st !== 'down') return settle(false, 'The defender got a foot in', 'TACKLED', 0)
    if (st === 'line' || el < outAt + plan.m1 * 0.5) return settle(false, 'He was on his line: the chip dropped into his arms', 'SAVED', 0)
    if (st === 'down' || el > downAt - 700) return plan.roll < 0.62 + t * 0.3 ? settle(true, 'Dinked it over him', 'GOAL', 0) : settle(false, 'Too much on the chip: over the bar', 'OVER', 0)
    return plan.roll < 0.3 + t * 0.3 ? settle(true, 'Dinked it over him', 'GOAL', 0) : settle(false, 'Not enough on it: he backpedalled and took it', 'SAVED', 0)
  }
  useKeys({ ArrowLeft: e => press(-1, e), ArrowUp: e => press(0, e), ArrowRight: e => press(1, e), a: e => press(-1, e), w: e => press(0, e), d: e => press(1, e), ' ': e => press(0, e), e: chip, E: chip })
  return (
    <div className="mg-play mg-play--soc">
      <div className="mg-box"><Fx r={fx} /><div className={`mg-rush mg-keeper is-${state}`}><i>KEEPER · {OO_WORD[state]}{state === 'down' ? (plan.kside < 0 ? ' ◀' : ' ▶') : ''}</i></div></div>
      <PitchTop tag="THROUGH ON GOAL">
        <span className="mg-pt" ref={gk} style={{ transform: at2(50, 12) }}><span className="mg-dot is-gk" /></span>
        <span className="mg-pt" ref={def} style={{ transform: at2(36, 99) }}><span className="mg-dot is-d" /></span>
        <span className="mg-pt" ref={me} style={{ transform: at2(46, 92) }}><span className="mg-dot is-me" /></span>
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(50, 30) }}><span className="mg-dot is-sball is-hide" /></span>
      </PitchTop>
      <div className="mg-sides mg-sides--three">
        <SocBtn refFn={el => { btns.current.L = el }} onPress={e => press(-1, e)} k="←">LEFT</SocBtn>
        <SocBtn refFn={el => { btns.current.C = el }} onPress={e => press(0, e)} k="↑">SHOOT</SocBtn>
        <SocBtn refFn={el => { btns.current.R = el }} onPress={e => press(1, e)} k="→">RIGHT</SocBtn>
      </div>
      <div className="mg-sides mg-sides--one"><SocBtn refFn={el => { btns.current.CH = el }} onPress={chip} k="E">CHIP</SocBtn></div>
      <Hint>HIT IT BEFORE HE’S SET · DINK HIM IF HE’S OFF HIS LINE · ROUND HIM WHEN HE GOES DOWN</Hint>
    </div>
  )
}

// ── Header: lose your marker, then go up as it gets there and pick the corner ──
function Head({ v, seed, onDone }) {
  const r = useRng(seed)
  const t = (clamp(v, 1, 11) - 1) / 10
  const plan = useMemo(() => {
    const looks = []; let at = 900 + r() * 500
    const n = r() < 0.55 ? 1 : r() < 0.6 ? 2 : 0
    for (let i = 0; i < n; i++) { const d = 150 + r() * 110; looks.push({ at, end: at + d, long: false }); at += d + 420 + r() * 520 }
    const longMs = 330 + t * 310
    looks.push({ at, end: at + longMs, long: true })
    return { looks, deadline: at + longMs + 260, across: r() < 0.4, moveF: 0.06 + r() * 0.22, flight: 1000 + r() * 100 }
  }, [r]) // eslint-disable-line
  const W = 85 + t * 85
  const [beat, setBeat] = useState('mark')
  const [watch, setWatch] = useState(false)
  const S = useRef({ t0: 0, free: false, arrive: 0, gone: false, done: false })
  const ballEl = useRef(null), gk = useRef(null), mark = useRef(null), fx = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const t0 = now(); S.current = { t0, free: false, arrive: 0, gone: false, done: false }
    let raf = 0
    const tick = () => {
      const s = S.current
      if (s.done || s.arrive) return
      const el = now() - t0
      setWatch(plan.looks.some(l => el >= l.at && el < l.end))
      if (el >= plan.deadline) return cross(false)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line
  const cross = free => {
    const s = S.current
    if (s.arrive) return
    s.free = free; s.arrive = now() + 300 + plan.flight
    setBeat('cross'); setWatch(false)
    moveTo(mark.current, free ? 56 : 51, free ? 66 : 58, 400)
    glide(ballEl.current, [{ transform: at2(100, 50) }, { transform: at2(74, 12) }, { transform: at2(50, 54) }], plan.flight, now() + 300, { fill: 'forwards', easing: 'linear' })
    if (plan.across) later(() => { s.gone = true; moveTo(gk.current, 40, 14, 320) }, 300 + plan.flight * plan.moveF)
    later(() => { if (!S.current.done) settle(null, false, 'Never got there: it flashed across goal', 'MISSED IT') }, 300 + plan.flight + W + 40)
  }
  const settle = (k, goal, why, word) => {
    const s = S.current
    if (s.done) return
    s.done = true
    if (k != null) { flash(btns.current[sideOf(k)], goal ? 'hit' : 'miss'); freeze(ballEl.current); moveTo(ballEl.current, k < 0 ? 37 : 63, goal ? 6 : 14, 300, 'ease-in') }
    say(fx.current, word, goal ? 'hit' : 'miss'); if (goal) { sfx('stamp'); haptic('heavy') } else bad()
    later(() => end({ score: goal ? clamp(0.6 + (s.free ? 0.15 : 0) + 0.2 * (s.q ?? 0.5), 0, 1) : 0.2, hit: goal, note: why }), 650)
  }
  // the run: near post or far post. Near, the near corner's the one (unless the keeper's across); far, back across him
  const run = (post, e) => {
    const s = S.current
    if (beat !== 'mark' || s.arrive) return
    const el = pressAt(e) - s.t0
    const look = plan.looks.find(l => el >= l.at && el < l.end)
    s.post = post
    flash(btns.current[post], look?.long ? 'hit' : 'miss')
    say(fx.current, look?.long ? 'LOST HIM' : 'MARKER WENT WITH HIM', look?.long ? 'hit' : 'miss')
    cross(!!look?.long)
  }
  const head = (k, e) => {
    const s = S.current
    if (beat !== 'cross' || s.done) return
    const e2 = pressAt(e) - s.arrive, win = s.free ? W : W * 0.62
    if (Math.abs(e2) > win) return settle(k, false, e2 < 0 ? 'Went up too early: over the bar' : 'Too late: it came off the back of his head', 'OVER THE BAR')
    s.q = 1 - Math.abs(e2) / win
    const open = s.post === 'NEAR' ? (s.gone ? -1 : 1) : (s.gone ? 1 : -1)
    if (k !== open) return settle(k, false, s.free ? 'Headed it straight at the keeper' : 'Weak header, the keeper gathered it', 'SAVED')
    if (!s.free && s.q < 0.45) return settle(k, false, 'Couldn’t get enough on it with him on his back', 'SAVED')
    settle(k, true, k < 0 ? 'Back across the keeper, into the far corner' : 'Flicked it in at the near post', 'GOAL')
  }
  useKeys({ ArrowUp: e => run('NEAR', e), ArrowDown: e => run('FAR', e), w: e => run('NEAR', e), s: e => run('FAR', e), ArrowLeft: e => head(-1, e), ArrowRight: e => head(1, e), a: e => head(-1, e), d: e => head(1, e) })
  return (
    <div className="mg-play mg-play--soc">
      <div className="mg-box"><Fx r={fx} /><div className={`mg-rush mg-marker${watch ? ' is-watch' : ''}`}><i>{beat === 'mark' ? (watch ? 'HE’S BALL-WATCHING' : 'TIGHT ON HIM') : 'ATTACK IT'}</i></div></div>
      <PitchTop tag="CROSS FROM THE RIGHT">
        <span className="mg-pt" ref={gk} style={{ transform: at2(58, 14) }}><span className="mg-dot is-gk" /></span>
        <span className="mg-pt" ref={mark} style={{ transform: at2(52, 70) }}><span className="mg-dot is-d" /></span>
        <span className="mg-pt" style={{ transform: at2(46, 66) }}><span className="mg-dot is-me" /></span>
        <span className="mg-pt mg-meet" style={{ transform: at2(50, 54) }}><i /></span>
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(100, 50) }}><span className="mg-dot is-sball" /></span>
      </PitchTop>
      {beat === 'mark'
        ? <div className="mg-sides"><SocBtn refFn={el => { btns.current.NEAR = el }} onPress={e => run('NEAR', e)} k="↑">NEAR POST</SocBtn><SocBtn refFn={el => { btns.current.FAR = el }} onPress={e => run('FAR', e)} k="↓">FAR POST</SocBtn></div>
        : <div className="mg-sides"><SocBtn refFn={el => { btns.current.L = el }} onPress={e => head(-1, e)} k="←">LEFT</SocBtn><SocBtn refFn={el => { btns.current.R = el }} onPress={e => head(1, e)} k="→">RIGHT</SocBtn></div>}
      <Hint>{beat === 'mark' ? 'MAKE THE RUN WHEN HE’S BALL-WATCHING' : 'ATTACK IT · BACK ACROSS THE KEEPER, OR THE CORNER HE’S LEFT'}</Hint>
    </div>
  )
}

// ── Volley: first time as it drops, or a touch and a shot before he closes you down ──
function Vol({ v, seed, onDone }) {
  const r = useRng(seed)
  const t = (clamp(v, 1, 11) - 1) / 10
  // (it never drops the same way twice: a high looping one, one driven back at him, one that bounces in front of him)
  const plan = useMemo(() => { const kind = ['HIGH ONE', 'DRIVEN BACK AT HIM', 'IT’S GOING TO BOUNCE'][Math.floor(r() * 3)]; return { kind, wait: 900 + r() * 500, flight: kind === 'HIGH ONE' ? 1500 + r() * 150 : kind === 'DRIVEN BACK AT HIM' ? 1000 + r() * 120 : 1300 + r() * 150, block: 520 + r() * 260, side: r() < 0.5 ? -1 : 1 } }, [r])
  const Wv = 42 + t * 58, Wt = 75 + t * 75, Ws = 48 + t * 60
  const [beat, setBeat] = useState('drop')
  const S = useRef({ drop: 0, touch: 0, ring: 0, done: false, heavy: false })
  const ballEl = useRef(null), def = useRef(null), fx = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  useLayoutEffect(() => {
    const start = now() + plan.wait, drop = start + plan.flight
    S.current = { drop, touch: 0, ring: 0, done: false, heavy: false }
    glide(ballEl.current, [{ transform: at2(52, 24) }, { transform: at2(48, 4), offset: 0.45 }, { transform: at2(45, 78) }], plan.flight, start, { fill: 'forwards', easing: 'linear' })
    later(() => sfx('tap'), plan.wait)
    later(() => { const s = S.current; if (!s.touch && !s.done) settle(false, 'Let it bounce: they cleared it', 'CLEARED') }, plan.wait + plan.flight + Wt * 2.2)
  }, []) // eslint-disable-line
  const settle = (goal, why, word, q = 0.5, k = null) => {
    const s = S.current
    if (s.done) return
    s.done = true
    if (k) flash(btns.current[k], goal ? 'hit' : 'miss')
    freeze(def.current); freeze(ballEl.current)
    const over = word === 'OVER THE BAR', blocked = word === 'BLOCKED'
    moveTo(ballEl.current, goal ? 50 + plan.side * 9 : over ? 50 + plan.side * 6 : blocked ? 62 : 50 + plan.side * 4, goal ? 6 : over ? -4 : blocked ? 70 : 16, 380, 'ease-in')
    say(fx.current, word, goal ? 'hit' : 'miss'); if (goal) { sfx('stamp'); haptic('heavy') } else bad()
    const vol = !s.touch
    later(() => end({ score: goal ? clamp((vol ? 0.72 : 0.58) + (vol ? 0.28 : 0.3) * q, 0, 1) : 0.15, hit: goal, note: why }), 650)
  }
  const press = (kind, e) => {
    const s = S.current
    if (s.done) return
    const ts = pressAt(e)
    if (beat === 'drop') {
      const e2 = ts - s.drop
      if (ts < s.drop - Wt * 2.5) return
      if (kind === 'VOLLEY') {
        if (Math.abs(e2) > Wv) return e2 < 0 ? settle(false, 'Leaned back and lifted it over', 'OVER THE BAR', 0, 'VOLLEY') : settle(false, 'Scuffed it, straight at the keeper', 'SAVED', 0, 'VOLLEY')
        const q = 1 - Math.abs(e2) / Wv
        return q >= 0.4 ? settle(true, q > 0.8 ? 'Caught it sweet on the volley' : 'Volleyed it in', 'GOAL', q, 'VOLLEY') : settle(false, 'Got it on target, the keeper got down to it', 'SAVED', q, 'VOLLEY')
      }
      if (kind !== 'TOUCH') return
      if (Math.abs(e2) > Wt * 1.9) return settle(false, 'Miscontrolled it', 'MISCONTROLLED', 0, 'TOUCH')
      s.heavy = Math.abs(e2) > Wt; s.touch = ts; s.ring = ts + 540 + (s.heavy ? 230 : 0)
      flash(btns.current.TOUCH, s.heavy ? 'miss' : 'hit'); say(fx.current, s.heavy ? 'HEAVY TOUCH' : 'GOOD TOUCH', s.heavy ? 'miss' : 'hit'); haptic('light')
      halt(ballEl.current); if (ballEl.current) ballEl.current.style.transform = at2(46, s.heavy ? 70 : 76)
      glide(def.current, [{ transform: at2(58, 40) }, { transform: at2(49, 74) }], plan.block, ts, { fill: 'forwards' })
      setBeat('shoot')
      later(() => { if (!S.current.done) settle(false, 'Took too long: the defender closed him down', 'BLOCKED') }, s.ring + Ws - now())
      return
    }
    if (ts >= s.touch + plan.block) return settle(false, 'The defender got the block in', 'BLOCKED', 0, 'SHOOT')
    const e2 = ts - s.ring
    if (e2 < -Ws) return settle(false, 'Snatched at it: the keeper had it covered', 'SAVED', 0.25, 'SHOOT')
    const q = 1 - Math.abs(e2) / Ws
    if (q >= 0.4) settle(true, 'Took a touch and finished it', 'GOAL', q, 'SHOOT'); else settle(false, 'Not enough on it: saved', 'SAVED', q, 'SHOOT')
  }
  useKeys({ ArrowLeft: e => press('TOUCH', e), ArrowRight: e => press('VOLLEY', e), a: e => press('TOUCH', e), d: e => press('VOLLEY', e), ' ': e => press('SHOOT', e), Enter: e => press('SHOOT', e) })
  return (
    <div className="mg-play mg-play--soc">
      <div className="mg-box"><Fx r={fx} /></div>
      <PitchTop tag={plan.kind}>
        <span className="mg-pt" style={{ transform: at2(50, 12) }}><span className="mg-dot is-gk" /></span>
        <span className="mg-pt" ref={def} style={{ transform: at2(58, 40) }}><span className="mg-dot is-d" /></span>
        <span className="mg-pt" style={{ transform: at2(44, 84) }}><span className="mg-dot is-me" /></span>
        <span className="mg-pt mg-meet" style={{ transform: at2(45, 78) }}><i /></span>
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(52, 24) }}><span className="mg-dot is-sball" /></span>
      </PitchTop>
      {beat === 'drop'
        ? <div className="mg-sides"><SocBtn refFn={el => { btns.current.TOUCH = el }} onPress={e => press('TOUCH', e)} k="←">TAKE A TOUCH</SocBtn><SocBtn refFn={el => { btns.current.VOLLEY = el }} onPress={e => press('VOLLEY', e)} k="→">VOLLEY</SocBtn></div>
        : <div className="mg-sides mg-sides--one"><SocBtn refFn={el => { btns.current.SHOOT = el }} onPress={e => press('SHOOT', e)} k="SPACE">SHOOT</SocBtn></div>}
      <Hint>{beat === 'drop' ? 'AS IT DROPS TO HIM' : 'BEFORE THE DEFENDER CLOSES HIM DOWN'}</Hint>
    </div>
  )
}

// ── Dribble slalom: at each pole the arrow lights the way he takes it next; hit it before the window shuts ──
// (the 3-cone's Simple game, two ways: clean, quick touches are the time; the wrong way clips the pole)
function Slalom({ v, seed, onDone }) {
  const r = useRng(seed)
  const t = (clamp(v, 1, 11) - 1) / 10
  const plan = useMemo(() => { const first = r() < 0.5 ? -1 : 1; return Array.from({ length: 6 }, (_, k) => ({ gap: 300 + r() * 380, dir: k % 2 ? first : -first })) }, [r])
  const clean = 0.45 + 25.3 / (4.1 + t * 1.2)        // (the Advanced course's clean run: about 25 m in and out of the poles)
  const [i, setI] = useState(0)
  const [cue, setCue] = useState(null)
  const [scores, setScores] = useState([])
  const R = useRef({ at: 0, done: false })
  const slips = useRef(0), btns = useRef({}), fx = useRef(null)
  const [end] = useOnce(onDone)
  const T = (480 + v * 42) * 0.85 * Math.pow(0.93, i)
  useEffect(() => {
    setCue(null); R.current = { at: 0, done: false }
    const t1 = setTimeout(() => { R.current.at = now(); setCue(plan[i].dir) }, plan[i].gap)
    const t2 = setTimeout(() => settle(0, 'HEAVY TOUCH'), plan[i].gap + T)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i]) // eslint-disable-line
  const settle = (s, word, k = null) => {
    if (R.current.done) return
    R.current.done = true
    if (k) flash(btns.current[k], s ? 'hit' : 'miss')
    say(fx.current, s ? grade(s) : word, s ? 'hit' : 'miss')
    if (s) good(s >= 0.85); else { bad(); slips.current++ }
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= plan.length) {
      const made = next.filter(Boolean).length
      const sharp = made ? next.filter(Boolean).reduce((a, b) => a + b, 0) / made : 0
      const secs = Math.round((clean + slips.current * 0.36 + (1 - sharp) * 0.3) * 100) / 100
      const score = clamp((clean + 0.55 + 0.6 - secs) / 1.2, 0, 1), hit = score >= 0.5
      end({ score, hit, note: `${secs.toFixed(2)}s · ${made} of ${plan.length} clean`, raw: { secs, made, of: plan.length },
        stat: { label: 'DRIBBLE SLALOM', value: secs.toFixed(2), unit: 'SEC', verdict: hit ? (made === plan.length ? 'QUICK FEET' : 'GOOD TIME') : 'TOO SLOW', sub: `${made} of ${plan.length} clean touches` } })
    } else setI(i + 1)
  }
  const go = (d, e) => {
    const S = R.current
    if (S.done) return
    const ts = pressAt(e)
    if (cue == null || ts < S.at) return settle(0, 'TOO EARLY', sideOf(d))
    if (d !== plan[i].dir) return settle(0, 'CLIPPED THE POLE', sideOf(d))
    settle(clamp(1 - (ts - S.at) / T * 0.6, 0.4, 1), null, sideOf(d))
  }
  useKeys({ ArrowLeft: e => go(-1, e), ArrowRight: e => go(1, e), a: e => go(-1, e), d: e => go(1, e) })
  return (
    <div className="mg-play mg-play--cone">
      <div className="mg-box"><Fx r={fx} /><span className={`mg-cue${cue != null ? ' is-on' : ''}`}>{cue != null ? <IconCaret dir={cue < 0 ? 'left' : 'right'} size={44} /> : <i className="mg-cue-wait" />}</span></div>
      <div className="mg-sides">
        <SocBtn refFn={el => { btns.current.L = el }} onPress={e => go(-1, e)} k="←"><IconCaret dir="left" size={14} /> LEFT</SocBtn>
        <SocBtn refFn={el => { btns.current.R = el }} onPress={e => go(1, e)} k="→">RIGHT <IconCaret dir="right" size={14} /></SocBtn>
      </div>
      <Hint touch="TAP" desk="ARROWS">THE WAY IT POINTS, AS IT LIGHTS · POLE {i + 1} OF {plan.length}</Hint>
      <Dots n={plan.length} of={scores} />
    </div>
  )
}

// ── Finishing drill: a target in each corner; lock it across, then up and down ──
const GOAL_TARGETS = [[12, 22], [88, 22], [12, 76], [88, 76], [12, 49], [88, 49]]
const GOAL_SPOTS = ['EDGE OF THE BOX', 'LEFT CHANNEL', 'RIGHT CHANNEL', 'THE SPOT', 'FIRST TIME']
function GoalAim({ v, seed, onDone }) {
  const r = useRng(seed)
  const order = useMemo(() => { const o = []; let last = -1; for (let i = 0; i < 5; i++) { let k = Math.floor(r() * 6); if (k === last) k = (k + 1) % 6; o.push(k); last = k } return o }, [r])
  const rad = 7 + (clamp(v, 1, 11) - 1) * 0.55            // the target's radius in % of the goal's width
  const [i, setI] = useState(0)
  const [axis, setAxis] = useState('x')
  const [scores, setScores] = useState([])
  const [shot, setShot] = useState(null)
  const A = useRef({ t0: now(), axis: 'x', X: 50, live: true })
  const lx = useRef(null), ly = useRef(null), fx = useRef(null)
  const [end, ended] = useOnce(onDone)
  const later = useTimers()
  const speed = 1.05 + i * 0.12
  const posAt = ts => tri(Math.max(0, ts - A.current.t0) / 1000 * speed * (A.current.axis === 'y' ? 1.2 : 1)) * 100
  useEffect(() => { if (lx.current) { lx.current.style.transform = ''; glide(lx.current, SWEEP, 2000 / speed, A.current.t0, { iterations: Infinity }) } }, [i]) // eslint-disable-line
  useEffect(() => { if (axis === 'y' && ly.current && A.current.live) { ly.current.style.transform = ''; glide(ly.current, SWEEP_Y, 2000 / (speed * 1.2), A.current.t0, { iterations: Infinity }) } }, [axis, i]) // eslint-disable-line
  const tap = e => {
    const a = A.current
    if (!a.live || ended.current) return
    const ts = pressAt(e), p = posAt(ts)
    if (a.axis === 'x') { a.X = p; a.axis = 'y'; a.t0 = ts; halt(lx.current); if (lx.current) lx.current.style.transform = `translate3d(${p}%,0,0)`; haptic('light'); setAxis('y'); return }
    a.live = false
    halt(ly.current); if (ly.current) ly.current.style.transform = `translate3d(0,${p}%,0)`
    const [tx, ty] = GOAL_TARGETS[order[i]], X = a.X, Y = p
    // (the goal face is 3:1: a % down is a third of a % across)
    const d = Math.hypot((X - tx) / rad, ((Y - ty) / 3) / rad)
    const s = d <= 1 ? clamp(1 - d * 0.5, 0.5, 1) : 0
    say(fx.current, s ? 'TARGET' : Math.abs(X - tx) > Math.abs(Y - ty) / 3 ? 'WIDE' : Y < ty ? 'HIGH' : 'LOW', s ? 'hit' : 'miss')
    if (s) { good(s >= 0.85); sfx('catchball') } else bad()
    setShot({ x: X, y: Y, hit: !!s })
    const next = [...scores, s]
    setScores(next)
    if (i + 1 >= order.length) {
      const made = next.filter(Boolean).length, hit = made >= 3
      end({ score: hit ? 0.5 + 0.5 * (made - 3) / 2 : 0.45 * made / 3, hit, note: `${made} of 5 on target`, raw: { made, of: 5 },
        stat: { label: 'FINISHING DRILL', value: `${made}/5`, unit: 'ON TARGET', verdict: hit ? (made === 5 ? 'PERFECT' : 'GOOD FINISHING') : 'NOT ENOUGH', sub: '' } })
      return
    }
    later(() => { A.current = { t0: now(), axis: 'x', X: 50, live: true }; setI(i + 1); setAxis('x'); setShot(null) }, 520)
  }
  useKeys({ ' ': tap, Enter: tap })
  const k = order[i]
  return (
    <div className="mg-play mg-play--aim" onPointerDown={primary(tap)}>
      <div className="mg-box">
        <Fx r={fx} />
        <div className="mg-field mg-goalface">
          {GOAL_TARGETS.map(([x, y], j) => <span key={j} className={`mg-goal-target${j === k ? ' is-lit' : ''}`} style={{ left: `${x}%`, top: `${y}%`, width: `${rad * 2}%` }} />)}
          <span className={`mg-line-x${axis === 'x' && !shot ? ' is-live' : ''}`} ref={lx} />
          {axis === 'y' && <span className={`mg-line-y${!shot ? ' is-live' : ''}`} ref={ly} />}
          {shot && <span className={`mg-ball${shot.hit ? ' is-hit' : ''}`} style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />}
        </div>
      </div>
      <Hint touch="TAP" desk="SPACE">{GOAL_SPOTS[i]} · {axis === 'x' ? 'TO LOCK LEFT–RIGHT' : 'TO LOCK UP–DOWN'} · BALL {i + 1} OF 5</Hint>
      <Dots n={order.length} of={scores} />
    </div>
  )
}

// ═══ Soccer, more: the free kick, the 2-on-1, the first-touch trial ═══════════
// (the Simple versions of lib/mg/freekick.js, counter.js and firsttouch.js: the same calls, on the small pitch)

// ── Free kick: pick the kick for the wall, then strike it in the zone ──
// CURL goes over the wall (the keeper can't see it): the zone's the height. LOW goes under the wall when it jumps, unless
// a man's lying behind it. DRIVEN goes at the keeper's side: he sees it all the way, so it has to be right in the middle.
const FK_WORD = { curl: 'CURL', low: 'LOW', drive: 'DRIVEN' }
function FreeKickS({ v, seed, onDone }) {
  const r = useRng(seed)
  const plan = useMemo(() => ({ side: r() < 0.5 ? -1 : 1, sleeper: r() < 0.38, zone: 38 + r() * 24, speed: 1.45 + r() * 0.25 }), [r])
  const [kick, setKick] = useState(null)
  const S = useRef({ done: false, at: 0 })
  const mark = useRef(null), zoneEl = useRef(null), fx = useRef(null), ballEl = useRef(null), gk = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  const width = zw(v) * (kick === 'low' ? 0.8 : kick === 'drive' ? 0.85 : 1)
  const { at, dir, stop } = useSweep(mark, plan.speed)
  const sd = plan.side
  const choose = (k, e) => {
    if (kick || S.current.done) return
    S.current.at = pressAt(e)
    flash(btns.current[k], 'hit'); haptic('light')
    setKick(k)
  }
  const settle = (goal, why, word, q = 0) => {
    const s = S.current
    if (s.done) return
    s.done = true
    const over = word === 'OVER THE BAR', wall = word === 'BLOCKED'
    moveTo(ballEl.current, goal ? 50 + sd * 11 : over ? 50 + sd * 9 : wall ? 50 + sd * 7 : 50 - sd * 4, goal ? 7 : over ? -4 : wall ? 47 : 15, 420, 'ease-in')
    if (word === 'SAVED') moveTo(gk.current, 50 - sd * 2, 15, 300)
    else if (goal) moveTo(gk.current, 50 + sd * 3, 16, 380)
    say(fx.current, word, goal ? 'hit' : 'miss'); if (goal) { sfx('stamp'); haptic('heavy') } else bad()
    later(() => end({ score: goal ? clamp(0.62 + 0.38 * q, 0, 1) : word === 'SAVED' ? 0.3 : 0.15, hit: goal, note: why }), 650)
  }
  const strike = e => {
    const s = S.current
    if (!kick || s.done) return
    const ts = pressAt(e)
    if (ts - s.at < 220) return
    const p = at(ts) * 100, j = judgeBar(p, plan.zone, width, dir(ts))
    stop(p); flash(zoneEl.current, j.hit ? 'hit' : 'miss')
    const early = !j.hit && j.word === 'EARLY'
    if (kick === 'curl') {
      if (!j.hit) return early ? settle(false, 'Didn’t get it up: into the wall', 'BLOCKED') : settle(false, 'Too much on it: over the bar', 'OVER THE BAR')
      return j.q >= 0.62 ? settle(true, 'Over the wall, into the corner', 'GOAL', j.q) : settle(false, 'Over the wall, but he got across to it', 'SAVED', j.q)
    }
    if (kick === 'low') {
      if (plan.sleeper) return settle(false, 'Under the wall, but the man lying behind it kept it out', 'BLOCKED')
      if (!j.hit) return early ? settle(false, 'Hit it too soon: the wall was still down', 'BLOCKED') : settle(false, 'Dragged it wide', 'WIDE')
      return j.q >= 0.6 ? settle(true, 'Under the jumping wall and in', 'GOAL', j.q) : settle(false, 'Under the wall, straight at the keeper', 'SAVED', j.q)
    }
    if (!j.hit) return early ? settle(false, 'Snatched at it: into the wall', 'BLOCKED') : settle(false, 'Leaned back: over the bar', 'OVER THE BAR')
    return j.q >= 0.84 ? settle(true, 'Drilled in at the keeper’s side', 'GOAL', j.q) : settle(false, 'He saw it all the way', 'SAVED', j.q)
  }
  useKeys({ ArrowLeft: e => choose('curl', e), ArrowUp: e => choose('drive', e), ArrowDown: e => choose('low', e), ArrowRight: e => choose('drive', e), ' ': strike, Enter: strike })
  const wallX = [0, 1, 2].map(i => 50 + sd * (12 - i * 5))
  return (
    <div className="mg-play mg-play--soc" onPointerDown={kick ? primary(strike) : undefined}>
      <div style={{ visibility: kick ? 'visible' : 'hidden' }}><Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={plan.zone} width={width} label={kick ? FK_WORD[kick] : null} /></div>
      <PitchTop tag={plan.sleeper ? 'A MAN BEHIND THE WALL' : 'FREE KICK'}>
        <span className="mg-pt" ref={gk} style={{ transform: at2(50 - sd * 5, 14) }}><span className="mg-dot is-gk" /></span>
        {wallX.map((x, i) => <span key={i} className="mg-pt" style={{ transform: at2(x, 46) }}><span className="mg-dot is-d" /></span>)}
        {plan.sleeper && <span className="mg-pt" style={{ transform: at2(50 + sd * 7, 40) }}><span className="mg-dot is-d" style={{ transform: 'scale(1.3,0.55)' }} /></span>}
        <span className="mg-pt" style={{ transform: at2(50 + sd * 16, 82) }}><span className="mg-dot is-me" /></span>
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(50 + sd * 14, 76) }}><span className="mg-dot is-sball" /></span>
      </PitchTop>
      {!kick
        ? <div className="mg-sides mg-sides--three">
          <SocBtn refFn={el => { btns.current.curl = el }} onPress={e => choose('curl', e)} k="←">CURL</SocBtn>
          <SocBtn refFn={el => { btns.current.low = el }} onPress={e => choose('low', e)} k="↓">LOW</SocBtn>
          <SocBtn refFn={el => { btns.current.drive = el }} onPress={e => choose('drive', e)} k="→">DRIVEN</SocBtn>
        </div>
        : null}
      <Hint touch="TAP" desk="SPACE">{!kick ? 'CURL OVER THE WALL · LOW UNDER IT · DRIVEN AT THE KEEPER' : 'STRIKE IT IN THE ZONE'}</Hint>
    </div>
  )
}

// ── 2-on-1: the last man commits. He steps up: PASS. He drops off to the runner: SHOOT ──
const TO_WORD = { wait: 'BACKING OFF', ball: 'STEPS UP TO THE BALL', runner: 'DROPS OFF TO THE RUNNER' }
function TwoOneS({ v, seed, onDone }) {
  const r = useRng(seed)
  const t = (clamp(v, 1, 11) - 1) / 10
  const plan = useMemo(() => ({ side: r() < 0.5 ? -1 : 1, goes: r() < 0.5 ? 'ball' : 'runner', commit: 1500 + r() * 900, fake: r() < 0.45, zone: 35 + r() * 30, speed: 1.6 + r() * 0.2 }), [r])
  const T = 820 + t * 300
  const [word, setWord] = useState('wait')
  const [beat, setBeat] = useState('read')
  const S = useRef({ t0: 0, at: Infinity, done: false })
  const me = useRef(null), mate = useRef(null), cb = useRef(null), ballEl = useRef(null), fx = useRef(null), btns = useRef({}), mark = useRef(null), zoneEl = useRef(null)
  const [end] = useOnce(onDone)
  const later = useTimers()
  const { at, dir, stop } = useSweep(mark, plan.speed)
  const sd = plan.side
  useLayoutEffect(() => {
    const t0 = now(), run = plan.commit + T + 400
    S.current = { t0, at: t0 + plan.commit, done: false }
    glide(me.current, [{ transform: at2(50, 92) }, { transform: at2(50, 40) }], run, t0, { fill: 'forwards', easing: 'linear' })
    glide(ballEl.current, [{ transform: at2(52, 89) }, { transform: at2(52, 37) }], run, t0, { fill: 'forwards', easing: 'linear' })
    glide(mate.current, [{ transform: at2(50 + sd * 34, 90) }, { transform: at2(50 + sd * 22, 36) }], run, t0, { fill: 'forwards', easing: 'linear' })
    glide(cb.current, [{ transform: at2(50 + sd * 4, 48) }, { transform: at2(50 + sd * 5, 34) }], plan.commit, t0, { fill: 'forwards' })
    if (plan.fake) {
      const show = plan.goes === 'ball' ? 'runner' : 'ball'
      later(() => { if (!S.current.done) setWord(show) }, plan.commit - 700)
      later(() => { if (!S.current.done) setWord('wait') }, plan.commit - 370)
    }
    later(() => {
      if (S.current.done) return
      setWord(plan.goes); haptic('light')
      if (plan.goes === 'ball') moveTo(cb.current, 50, 44, T * 0.9)
      else moveTo(cb.current, 50 + sd * 16, 32, T * 0.9)
    }, plan.commit)
    later(() => { if (!S.current.done && S.current.shootAt == null) settle(false, plan.goes === 'ball' ? 'He got a foot in: took too long' : 'Took too long: he got back across to block it', plan.goes === 'ball' ? 'TACKLED' : 'BLOCKED') }, plan.commit + T)
  }, []) // eslint-disable-line
  const settle = (goal, why, word2, q = 0.5, k = null, to = null) => {
    const s = S.current
    if (s.done) return
    s.done = true
    ;[me.current, mate.current, cb.current, ballEl.current].forEach(el => el && freeze(el))
    if (k) flash(btns.current[k], goal ? 'hit' : 'miss')
    if (to) moveTo(ballEl.current, to[0], to[1], 380, 'ease-in')
    say(fx.current, word2, goal ? 'hit' : 'miss'); if (goal) { sfx('stamp'); haptic('heavy') } else bad()
    later(() => end({ score: goal ? clamp(0.62 + 0.38 * q, 0, 1) : 0.14, hit: goal, note: why }), 650)
  }
  const press = (k, e) => {
    const s = S.current
    if (s.done || beat !== 'read') return
    const ts = pressAt(e), early = ts < s.at
    if (k === 'PASS') {
      if (early || plan.goes !== 'ball') return settle(false, early ? 'Went too early: he read the pass and cut it out' : 'He was sitting on the pass: cut out', 'CUT OUT', 0, k, [50 + sd * 8, 36])
      const m = spot(mate.current)
      moveTo(ballEl.current, m.x, m.y, 260)
      later(() => settle(true, 'Squared it for the tap-in', 'GOAL', clamp(1 - (ts - s.at) / T, 0.3, 1), k, [50 + sd * 4, 7]), 280)
      return
    }
    if (early || plan.goes !== 'runner') return settle(false, early ? 'Went too early: he was there to block it' : 'He stepped up and blocked it', 'BLOCKED', 0, k, [50 + sd * 6, 50])
    flash(btns.current.SHOOT, 'hit'); haptic('light')
    S.current.shootAt = ts
    setBeat('shoot')
    later(() => { if (!S.current.done) settle(false, 'Took too long over it: he got back to block it', 'BLOCKED', 0, null, [50 + sd * 6, 50]) }, 2600)
  }
  const finish = e => {
    const s = S.current
    if (s.done || beat !== 'shoot') return
    const ts = pressAt(e)
    if (ts - s.shootAt < 200) return
    const p = at(ts) * 100, j = judgeBar(p, plan.zone, zw(v), dir(ts))
    stop(p); flash(zoneEl.current, j.hit ? 'hit' : 'miss')
    if (!j.hit) return settle(false, j.word === 'EARLY' ? 'Snatched at it: straight at the keeper' : 'Leaned back: over the bar', j.word === 'EARLY' ? 'SAVED' : 'OVER THE BAR', 0, null, j.word === 'EARLY' ? [50, 15] : [50 - sd * 6, -4])
    j.q >= 0.6 ? settle(true, 'Slotted it past the keeper', 'GOAL', j.q, null, [50 - sd * 10, 7]) : settle(false, 'Good save, down to his side', 'SAVED', j.q, null, [50 - sd * 7, 15])
  }
  useKeys({ ArrowLeft: e => press('PASS', e), ArrowRight: e => press('SHOOT', e), a: e => press('PASS', e), d: e => press('SHOOT', e), ' ': finish, Enter: finish })
  return (
    <div className="mg-play mg-play--soc" onPointerDown={beat === 'shoot' ? primary(finish) : undefined}>
      {beat === 'read'
        ? <div className="mg-box"><Fx r={fx} /><div className="mg-runup"><i>THE LAST MAN · {TO_WORD[word]}</i></div></div>
        : <Bar markRef={mark} zoneRef={zoneEl} fx={fx} zone={plan.zone} width={zw(v)} label="FINISH" />}
      <PitchTop tag="2 ON 1">
        <span className="mg-pt" style={{ transform: at2(50, 12) }}><span className="mg-dot is-gk" /></span>
        <span className="mg-pt" ref={cb} style={{ transform: at2(50 + sd * 4, 48) }}><span className="mg-dot is-d" /></span>
        <span className="mg-pt" ref={mate} style={{ transform: at2(50 + sd * 34, 90) }}><span className="mg-dot is-mate" /></span>
        <span className="mg-pt" ref={me} style={{ transform: at2(50, 92) }}><span className="mg-dot is-me" /></span>
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(52, 89) }}><span className="mg-dot is-sball" /></span>
      </PitchTop>
      {beat === 'read'
        ? <div className="mg-sides">
          <SocBtn refFn={el => { btns.current.PASS = el }} onPress={e => press('PASS', e)} k="←">PASS</SocBtn>
          <SocBtn refFn={el => { btns.current.SHOOT = el }} onPress={e => press('SHOOT', e)} k="→">SHOOT</SocBtn>
        </div>
        : null}
      <Hint touch="TAP" desk="SPACE">{beat === 'read' ? 'HE STEPS UP: PASS · HE DROPS OFF: SHOOT' : 'FINISH IT IN THE ZONE'}</Hint>
    </div>
  )
}

// ── First touch: keep-ups (the foot it drops to, as it gets there), then kill the coach's passes dead ──
const FT_UPS = 12, FT_BALLS = 3, FT_NEED = 15
function TouchS({ v, seed, onDone }) {
  const r = useRng(seed)
  const t = (clamp(v, 1, 11) - 1) / 10
  const sides = useMemo(() => Array.from({ length: FT_UPS + FT_BALLS + 1 }, () => (r() < 0.5 ? -1 : 1)), [r])
  const W = 80 + t * 80, W2 = 80 + t * 70
  const [part, setPart] = useState('ups')
  const [ups, setUps] = useState(0)
  const [ctrl, setCtrl] = useState([])
  const S = useRef({ due: Infinity, side: 1, n: 0, live: false, done: false })
  const ballEl = useRef(null), ring = useRef(null), fx = useRef(null), btns = useRef({})
  const [end] = useOnce(onDone)
  const later = useTimers()
  // one keep-up: the ball up and down to a foot; the ring at that foot closes as it gets there
  const drop = (n, hang) => {
    const s = S.current, side = sides[n], due = now() + hang
    Object.assign(s, { due, side, n, live: true })
    const x = 50 + side * 9
    glide(ballEl.current, [{ transform: at2(50, 72) }, { transform: at2((50 + x) / 2, 30), easing: 'ease-in' }, { transform: at2(x, 72) }], hang, now(), { fill: 'forwards', easing: 'ease-out' })
    if (ring.current) { ring.current.style.left = `${x}%`; ring.current.style.top = '72%'; glide(ring.current, [{ transform: 'scale(2.4)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 1 }], hang, now(), { fill: 'forwards' }) }
    later(() => { if (S.current.live && S.current.n === n && S.current.due === due) missUp('It hit the floor') }, hang + W)
  }
  const pass = k => {
    const s = S.current, side = sides[FT_UPS + k], travel = 1100 - k * 80, due = now() + 500 + travel
    Object.assign(s, { due, side, n: k, live: true, pass: true })
    const x = 50 + side * 9
    glide(ballEl.current, [{ transform: at2(50, 8) }, { transform: at2(50, 8), offset: 500 / (500 + travel) }, { transform: at2(x, 72) }], 500 + travel, now(), { fill: 'forwards', easing: 'linear' })
    if (ring.current) { ring.current.style.left = `${x}%`; glide(ring.current, [{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'scale(2.4)', opacity: 0.2, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }], 500 + travel, now(), { fill: 'forwards' }) }
    later(() => { if (S.current.live && S.current.pass && S.current.n === k) onPass(null) }, 500 + travel + W2)
  }
  useLayoutEffect(() => { later(() => drop(0, 820), 700) }, []) // eslint-disable-line
  const missUp = why => {
    const s = S.current
    s.live = false
    say(fx.current, s.n >= 8 ? `${s.n} KEEP-UPS` : 'DROPPED IT', s.n >= 8 ? 'hit' : 'miss'); bad()
    moveTo(ballEl.current, 50 + s.side * 22, 90, 420, 'ease-in')
    s.ups = s.n
    later(() => { setPart('control'); pass(0) }, 1200)
    void why
  }
  const onPass = tt => {
    const s = S.current
    s.live = false
    const side = s.side
    let ok = false, word = 'GOT AWAY FROM HIM'
    if (tt) { if (tt.side !== side) word = 'WRONG FOOT'; else if (Math.abs(tt.e) <= W2 * 0.45) { ok = true; word = 'KILLED IT' } else if (Math.abs(tt.e) <= W2) { ok = true; word = 'GOOD TOUCH' } else word = 'HEAVY TOUCH' }
    if (tt) flash(btns.current[tt.side < 0 ? 'L' : 'R'], ok ? 'hit' : 'miss')
    say(fx.current, word, ok ? 'hit' : 'miss'); ok ? good(word === 'KILLED IT') : bad()
    if (!ok) moveTo(ballEl.current, 50 + side * 28, 96, 500, 'ease-out')
    const next = [...ctrl, ok]
    setCtrl(next)
    if (s.n + 1 >= FT_BALLS) {
      const made = next.filter(Boolean).length, u = s.ups ?? 0, pts = u + made * 3, hit = pts >= FT_NEED
      later(() => end({ score: hit ? 0.5 + 0.5 * (pts - FT_NEED) / (FT_UPS + FT_BALLS * 3 - FT_NEED) : 0.45 * pts / FT_NEED, hit, note: `${u} keep-ups · ${made} of ${FT_BALLS} controlled`, raw: { ups: u, made, of: FT_BALLS, pts },
        stat: { label: 'FIRST TOUCH', value: String(pts), unit: 'POINTS', verdict: hit ? 'GOOD FEET' : 'NOT ENOUGH', sub: `${u} keep-ups · ${made} of ${FT_BALLS} controlled` } }), 700)
    } else later(() => pass(s.n + 1), 900)
  }
  const press = (side, e) => {
    const s = S.current
    if (!s.live || s.done) return
    const ts = pressAt(e), err = ts - s.due
    if (s.pass) { if (err < -W2 * 3) return; return onPass({ side, e: err }) }
    if (err < -W * 2.6) return
    flash(btns.current[side < 0 ? 'L' : 'R'], Math.abs(err) <= W && side === s.side ? 'hit' : 'miss')
    if (err < -W) return missUp('Swung at it too early')
    if (side !== s.side) return missUp('Wrong foot')
    const n = s.n + 1
    s.live = false
    setUps(n); good(Math.abs(err) <= W * 0.4)
    if (n >= FT_UPS) { s.n = n; s.ups = n; say(fx.current, `${FT_UPS}: THAT’LL DO`, 'hit'); later(() => { setPart('control'); pass(0) }, 1100); return }
    const hang = (760 - n * 17) * (Math.abs(err) <= W * 0.4 ? 1 : r() < 0.5 ? 0.84 : 1.1)
    drop(n, hang)
  }
  useKeys({ ArrowLeft: e => press(-1, e), ArrowRight: e => press(1, e), a: e => press(-1, e), d: e => press(1, e) })
  return (
    <div className="mg-play mg-play--soc">
      <div className="mg-box"><Fx r={fx} /><div className="mg-runup"><i>{part === 'ups' ? `KEEP-UPS · ${ups}` : `CONTROL · ${ctrl.filter(Boolean).length} OF ${FT_BALLS} · ${S.current.ups ?? ups} KEEP-UPS`}</i></div></div>
      <div className="mg-court mg-pitch" aria-hidden="true">
        <i className="mg-court-tag">{part === 'ups' ? 'KEEP IT UP' : 'KILL IT DEAD'}</i>
        <span className="mg-pt" style={{ transform: at2(50, 8), visibility: part === 'control' ? 'visible' : 'hidden' }}><span className="mg-dot is-mate" /></span>
        <span className="mg-pt" style={{ transform: at2(50, 80) }}><span className="mg-dot is-me" /></span>
        <span ref={ring} style={{ position: 'absolute', left: '50%', top: '72%', width: 22, height: 22, margin: '-11px 0 0 -11px', borderRadius: '50%', border: '2px solid rgba(255,255,255,.85)', pointerEvents: 'none' }} />
        <span className="mg-pt" ref={ballEl} style={{ transform: at2(50, 72) }}><span className="mg-dot is-sball" /></span>
      </div>
      <div className="mg-sides">
        <SocBtn refFn={el => { btns.current.L = el }} onPress={e => press(-1, e)} k="←">LEFT FOOT</SocBtn>
        <SocBtn refFn={el => { btns.current.R = el }} onPress={e => press(1, e)} k="→">RIGHT FOOT</SocBtn>
      </div>
      <Hint>{part === 'ups' ? 'THE FOOT IT DROPS TO, AS IT GETS THERE' : 'THE FOOT IT COMES TO, AS IT ARRIVES'}</Hint>
      {part === 'control' && <Dots n={FT_BALLS} of={ctrl} />}
    </div>
  )
}
