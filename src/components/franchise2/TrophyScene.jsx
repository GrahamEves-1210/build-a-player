import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../lib/juice'
import { fkVars } from './kit'
import './trophy.css'

// The trophy, after a Super Bowl win: the game's own football trophy (/trophy.webp, the one the season mode hands
// out; owner 11-18) rises into the light on the mode's black; the title comes up over it, the team's name under
// it, confetti in the team's two colours and white falls ONCE (College Basketball's net cutting:
// components/cbb/CutTheNet.jsx, the same method), and it rests with CONTINUE.
//   team: { name, color, color2, short }   title: the gold line over the cup   line: one more line under the name
//   onDone: CONTINUE, a tap anywhere once it rests, Enter or Escape. (A tap before then takes it to rest.)
// Reduced motion: the trophy and the words at once, no confetti. Nothing loops. The words and the button stop above
// the website's ad rail (--web-rail), and the ad's box is cut out of the layer (app-game.css's rule for full-screen
// layers, repeated in trophy.css).
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// (owner 11-18: the game's own football trophy, the regular season mode's, not the mode's rendered cup)
export const TROPHY_POSTER = '/trophy.webp'

function Confetti({ colors }) {
  // CutTheNet's confetti: every piece its own spot, delay, speed, size and turn, falling once
  const pieces = useMemo(() => Array.from({ length: 64 }, (_, i) => ({
    id: i, x: Math.random() * 100, delay: Math.random() * 1.3, dur: 2.1 + Math.random() * 1.7,
    color: colors[i % colors.length], size: 6 + Math.random() * 8, rot: Math.random() * 360,
  })), [colors])
  return (
    <div className="frt-confetti" aria-hidden="true">
      {pieces.map(p => <i key={p.id} style={{ left: `${p.x}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.color, width: p.size, height: p.size * 0.6, '--rot': `${p.rot}deg` }} />)}
    </div>
  )
}

export default function TrophyScene({ team, title = 'SUPER BOWL CHAMPIONS', line, onDone, sound = true }) {
  const [still] = useState(reduced)
  const [rest, setRest] = useState(still)          // on the last frame, CONTINUE up
  const [words, setWords] = useState(still ? 2 : 0) // 0 none · 1 the title · 2 the team's name too
  const [confetti, setConfetti] = useState(false)
  const root = useRef(null), btn = useRef(null)
  const timers = useRef([]), born = useRef(0), fell = useRef(false), done = useRef(false)
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const colors = useMemo(() => [team?.color || '#f2f4f5', team?.color2 || '#8b949e', '#ffffff'], [team?.color, team?.color2])

  const fall = useCallback(() => {
    if (fell.current || still) return
    fell.current = true
    setConfetti(true); if (sound) sfx('champion')
    later(() => setConfetti(false), 6200)
  }, [still, sound])
  // to rest: the last frame, every word, the button
  const settle = useCallback(() => { setWords(2); setRest(true); fall() }, [fall])

  useEffect(() => {
    born.current = performance.now()
    root.current?.focus?.({ preventScroll: true })
    if (still) return undefined
    // the trophy rises in (trophy.css), then the title, the team, the confetti
    later(() => setWords(1), 500)
    later(() => setWords(2), 1000)
    later(settle, 1300)
    return () => timers.current.forEach(clearTimeout)
  }, [still, settle])
  useEffect(() => { if (rest) btn.current?.focus?.({ preventScroll: true }) }, [rest])

  const finish = () => { if (done.current) return; done.current = true; onDone?.() }
  const tap = () => {
    if (rest) return finish()
    if (performance.now() - born.current < 700) return   // the tap that brought him here
    settle()
  }
  const onKey = e => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); tap() } }

  return (
    <div className={`frt${rest ? ' is-rest' : ''}${words > 0 ? ' has-title' : ''}${words > 1 ? ' has-name' : ''}${still ? ' is-still' : ''}`} style={{ '--frt-c1': colors[0], '--frt-c2': colors[1], ...(team?.short ? fkVars(team.short) : null) }}
      ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${title}. ${team?.name ?? ''}`} onClick={tap} onKeyDown={onKey}>
      <div className="frt-col">
        <p className="frt-title">{title}</p>
        <div className="frt-film">
          <img className="frt-poster is-cup" src={TROPHY_POSTER} alt="" width="800" height="1200" decoding="async" draggable={false} />
        </div>
        <div className="frt-foot">
          <i className="frt-rule" aria-hidden="true" />
          <h2 className="frt-name">{team?.name ?? team?.short ?? ''}</h2>
          {line ? <p className="frt-line">{line}</p> : null}
          <button ref={btn} type="button" className="frt-btn" onClick={e => { e.stopPropagation(); if (rest) finish() }} disabled={!rest} tabIndex={rest ? 0 : -1}>CONTINUE</button>
        </div>
      </div>
      {confetti && <Confetti colors={colors} />}
    </div>
  )
}
