import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../lib/juice'
import './trophy.css'

// The trophy, after a Super Bowl win: Franchise's own cup (three silver flames off a stepped plinth, bound by a
// gold collar, holding a silver football: modelled and rendered for the mode, public/franchise/trophy) turns out of
// the dark into the light and holds. The film plays once in a centred square on the mode's own black (the render's
// background is the same #0a0c0f, so the square has no edge); as it settles the title comes up over it and the
// team's name under it, confetti in the team's two colours and white falls ONCE (College Basketball's net cutting:
// components/cbb/CutTheNet.jsx, the same method), and it rests on the last frame with CONTINUE.
//   team: { name, color, color2, short }   title: the gold line over the cup   line: one more line under the name
//   onDone: CONTINUE, a tap anywhere once it rests, Enter or Escape. (A tap while the film runs takes it to rest.)
// Reduced motion: the last frame and the words, no film, no confetti. The film is asked for only when this is on
// screen (nothing preloads it), plays muted and inline, and if it can't play the last frame stands in.
// Nothing loops. The words and the button stop above the website's ad rail (--web-rail), and the ad's box is cut
// out of the layer (app-game.css's rule for full-screen layers, repeated in trophy.css).
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const DIR = '/franchise/trophy/'
export const TROPHY_POSTER = `${DIR}poster.webp`
// when, into the film, each thing happens (ms): the cup settles at 3.4s of 4.2
// the film: H.264 wherever it plays (every phone); the WebM for a browser built without it
const pickFilm = () => {
  try {
    const v = document.createElement('video')
    if (v.canPlayType('video/mp4; codecs="avc1.640020"')) return `${DIR}trophy.mp4`
    if (v.canPlayType('video/webm; codecs="vp9"')) return `${DIR}trophy.webm`
  } catch { /* the last frame stands in */ }
  return `${DIR}trophy.mp4`
}
const T_TITLE = 2200, T_NAME = 2750, T_CONFETTI = 3150, T_GIVE_UP = 6000

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
  const [film] = useState(() => (still ? null : pickFilm()))
  const [rest, setRest] = useState(still)          // on the last frame, CONTINUE up
  const [failed, setFailed] = useState(false)      // the film couldn't play: the last frame stands in
  const [words, setWords] = useState(still ? 2 : 0) // 0 none · 1 the title · 2 the team's name too
  const [confetti, setConfetti] = useState(false)
  const root = useRef(null), video = useRef(null), btn = useRef(null)
  const timers = useRef([]), born = useRef(0), fell = useRef(false), started = useRef(false), done = useRef(false)
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
    const v = video.current
    const giveUp = () => { if (!started.current) { setFailed(true); settle() } }
    const p = v?.play?.()
    if (p?.catch) p.catch(giveUp)
    later(giveUp, T_GIVE_UP)                       // never started (blocked, stalled, no codec): don't sit in the dark
    return () => timers.current.forEach(clearTimeout)
  }, [still, settle])
  useEffect(() => { if (rest) btn.current?.focus?.({ preventScroll: true }) }, [rest])

  const onPlaying = () => {
    if (started.current) return
    started.current = true
    later(() => setWords(w => Math.max(w, 1)), T_TITLE)
    later(() => setWords(2), T_NAME)
    later(fall, T_CONFETTI)
  }
  const finish = () => { if (done.current) return; done.current = true; onDone?.() }
  const tap = () => {
    if (rest) return finish()
    if (performance.now() - born.current < 700) return   // the tap that brought him here
    const v = video.current
    try { if (v && Number.isFinite(v.duration)) { v.pause(); v.currentTime = Math.max(0, v.duration - 0.02) } else setFailed(true) } catch { setFailed(true) }
    settle()
  }
  const onKey = e => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); tap() } }

  const showPoster = still || failed || rest
  return (
    <div className={`frt${rest ? ' is-rest' : ''}${words > 0 ? ' has-title' : ''}${words > 1 ? ' has-name' : ''}${still ? ' is-still' : ''}`} style={{ '--frt-c1': colors[0], '--frt-c2': colors[1] }}
      ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${title}. ${team?.name ?? ''}`} onClick={tap} onKeyDown={onKey}>
      <div className="frt-col">
        <p className="frt-title">{title}</p>
        <div className="frt-film">
          {!still && !failed && (
            <video ref={video} className="frt-video" muted playsInline autoPlay preload="auto" disablePictureInPicture disableRemotePlayback tabIndex={-1} aria-hidden="true"
              src={film} onPlaying={onPlaying} onEnded={settle} onError={() => { setFailed(true); settle() }} />
          )}
          {showPoster && <img className="frt-poster" src={TROPHY_POSTER} alt="" width="720" height="720" decoding="async" draggable={false} />}
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
