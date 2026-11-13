import { memo, useEffect, useMemo, useRef, useState } from 'react'
import MgStage from '../../app/MgStage'
import { GAMES } from '../../../lib/minigames'
import { minigameOpen } from '../../../lib/ads'
import { valToGrade } from '../../../utils/simulation'
import { sfx, haptic } from '../../../lib/juice'
import Scorebug from './Scorebug'
import { Face, IconFF, barOf, quarterText, clockText, spotText, downText, pct } from './parts'

// The live game: the scorebug, the drive log, the red SKIP bar. The engine's game is stepped one play at a time on
// a timer; when it stops (g.pending) the log gives way to the stop's panel: a moment's set-up, then the mini game on
// its own stage (MgStage), then the play that came of it; or a coach's call. Nothing here decides football: every
// play, every result's wording and every chance shown is the engine's (through the driver, bridge.js).
//   F, put(next, save)   the franchise with the game in it; put hands the next one up (save: also to the save)
//   g                    driver.view(F)

// how long a play stays the newest one on screen (ms): a full game under a minute watched, 2-4 minutes with moments
const PACE = { moments: { play: 330, big: 950, score: 1450 }, watch: { play: 230, big: 650, score: 1050 } }
const waitFor = (p, mode) => { const t = PACE[mode] ?? PACE.watch; return !p ? 500 : p.pts ? t.score : p.big || p.kind === 'break' ? t.big : t.play }

const ScoreLine = ({ home, away, score }) => <span className="frgd-play-score">{away} {score[away]} <i>·</i> {home} {score[home]}</span>

const Play = memo(function Play({ p, home, away, fresh }) {
  if (p.kind === 'break') return <div className="frgd-break">{p.text}</div>
  const def = p.team === home ? away : home
  const scored = !!p.pts
  return (
    <div className={`frgd-play${scored ? ' is-score' : ''}${p.big ? ' is-big' : ''}${fresh ? ' is-in' : ''}`} style={scored ? { '--bar': barOf(p.scorer ?? p.team).color } : undefined}>
      <div className="frgd-play-meta">
        {p.down ? <>{downText(p.down, p.dist, p.spot)}<i>{spotText(p.spot, p.team, def)}</i></> : <>{quarterText(p.q)}<i>{clockText(p.clock)}</i></>}
      </div>
      <p>
        {p.mark?.moment && <><span className="frgd-play-tag">{p.mark.played === false ? 'KEY MOMENT · SIMMED' : 'KEY MOMENT'}</span><br /></>}
        {p.mark?.call && <><span className="frgd-play-tag">COACH&rsquo;S CALL</span><br /></>}
        {p.text}
        {scored && <ScoreLine home={home} away={away} score={p.score} />}
      </p>
    </div>
  )
})

// the log, newest first, a ruled header where each drive starts
function DriveLog({ g }) {
  const rows = useMemo(() => {
    const out = [], drives = {}
    for (const p of g.plays) if (p.drive != null && p.down) { const d = (drives[p.drive] ??= { n: 0, yards: 0, from: p, team: p.team }); d.n += 1; d.yards += p.yards ?? 0 }
    for (let i = g.plays.length - 1; i >= 0; i--) {
      const p = g.plays[i]
      out.push({ p })
      const d = drives[p.drive]
      if (p.down && d && d.from === p) out.push({ drive: p.drive, d })
    }
    return out
  }, [g.plays])
  const newest = g.plays[g.plays.length - 1]
  return rows.map(r => r.p
    ? <Play key={`p${r.p.id}`} p={r.p} home={g.home} away={g.away} fresh={r.p === newest} />
    : (
      <div key={`d${r.drive}`} className="frgd-drive" style={{ '--bar': barOf(r.d.team).color }}>
        <b>{r.d.team} BALL</b>
        <span>{quarterText(r.d.from.q)} {clockText(r.d.from.clock)} · {r.d.n} {r.d.n === 1 ? 'PLAY' : 'PLAYS'} · {r.d.yards} YDS</span>
      </div>
    ))
}

// the desktop's left column: every score so far (a touchdown's line carries the score after its extra point)
function Scoring({ g }) {
  const list = []
  g.plays.forEach((p, i) => { if (p.pts && p.kind !== 'xp' && p.kind !== 'xpmiss' && p.kind !== 'two') { const nx = g.plays[i + 1]; list.push({ p, score: nx && (nx.kind === 'xp' || nx.kind === 'two') ? nx.score : p.score }) } })
  return (
    <aside className="frgd-aside">
      <div className="frgd-h"><span>SCORING</span></div>
      {!list.length && <div className="frgd-none">No score yet</div>}
      {list.map(({ p, score }) => (
        <div key={p.id} className="frgd-play is-score" style={{ '--bar': barOf(p.scorer ?? p.team).color }}>
          <div className="frgd-play-meta">{quarterText(p.q)}<i>{clockText(p.clock)}</i></div>
          <p>{p.text}<ScoreLine home={g.home} away={g.away} score={score} /></p>
        </div>
      ))}
    </aside>
  )
}

function Moment({ m }) {
  const p = m.player ?? {}
  return (
    <div className="frgd-stop" key={m.id}>
      <div className="frgd-stop-in">
        <span className="frgd-eye">KEY MOMENT{m.n ? ` ${m.n}` : ''}</span>
        <h2>{m.title ?? GAMES[m.game]?.title}</h2>
        <p className="frgd-stop-set">{m.setup}</p>
        <div className="frgd-who">
          <Face man={p} size={64} />
          <div>
            <strong>{p.name}</strong>
            <span>{[p.pos, p.num != null ? `#${p.num}` : null, p.team].filter(Boolean).join(' · ')}{p.built ? <> · <u>BUILT</u></> : null}</span>
          </div>
        </div>
        {!!m.ratings?.length && <div className="frgd-rate">{m.ratings.slice(0, 6).map(r => <div key={r.key}><span>{r.label}</span><b>{valToGrade(r.val)}</b></div>)}</div>}
        {m.stakes && <div className="frgd-stake"><span>AT STAKE</span><p>{m.stakes}</p></div>}
        {m.odds != null && <div className="frgd-stake"><span>SIM ODDS</span><b>{pct(m.odds)}</b></div>}
      </div>
    </div>
  )
}

function Result({ g, shown }) {
  const scored = shown.find(p => p.pts)
  return (
    <div className="frgd-stop">
      <div className="frgd-stop-in">
        <span className="frgd-eye">{shown[0]?.mark?.call ? 'THE CALL' : 'THE PLAY'}</span>
        {shown.map(p => <p key={p.id} className="frgd-res-play">{p.text}</p>)}
        {scored && <div className="frgd-res-score">{g.away} {g.score[g.away]} <i>·</i> {g.home} {g.score[g.home]}</div>}
      </div>
    </div>
  )
}

function Call({ c, onPick }) {
  return (
    <div className="frgd-stop" key={c.id}>
      <div className="frgd-stop-in">
        <span className="frgd-eye">COACH&rsquo;S CALL</span>
        <h2>{c.kind === 'two-point' ? 'ONE OR TWO' : 'FOURTH DOWN'}</h2>
        <p className="frgd-stop-set">{c.setup}</p>
        <div className="frgd-opts">
          {c.options.map(o => (
            <button key={o.id} type="button" className="frgd-opt" onClick={() => onPick(o.id)}>
              <span><strong>{o.label}</strong>{o.note && <small>{o.note}</small>}</span>
              {o.odds != null && <b>{pct(o.odds)}</b>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Live({ F, put, g, driver, title }) {
  const [playing, setPlaying] = useState(null)      // the moment on the mini game's stage
  const [shown, setShown] = useState(null)          // the plays a stop just made, held on screen until read
  const logRef = useRef(null)
  const now = useRef({ F, g }); now.current = { F, g }
  const stop = g.pending
  const newest = g.plays[g.plays.length - 1]

  // the feed: one play, then the next after that play's hold. It waits while a stop is up or its result is showing
  useEffect(() => {
    if (g.done || stop || shown || playing) return
    const t = setTimeout(() => {
      const next = driver.step(now.current.F), ng = driver.view(next)
      if (!ng) return
      const np = ng.plays[ng.plays.length - 1]
      if (np && np !== newest) { if (np.pts >= 6) { sfx('snd-roar'); haptic('medium') } else if (np.pts) sfx('tick') }
      if (ng.pending) { sfx('whistle'); haptic('medium') }
      put(next, !!ng.pending || ng.done)   // (a stop and the final go to the save: a reload comes back to them)
    }, waitFor(newest, g.mode))
    return () => clearTimeout(t)
  }, [F, g.done, stop, shown, playing]) // eslint-disable-line react-hooks/exhaustive-deps
  // the newest play is at the top: the log stays there
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0 }, [g.plays.length])
  // a moment on its stage has the site's own no-ads address for as long as it is up (lib/ads.js)
  useEffect(() => (playing ? minigameOpen() : undefined), [playing])
  // a result holds until it's read: a tap, or a few seconds
  useEffect(() => { if (!shown) return; const t = setTimeout(() => setShown(null), 4500); return () => clearTimeout(t) }, [shown])

  const after = (next, from) => {
    const ng = driver.view(next)
    const made = ng ? ng.plays.slice(from).filter(p => p.kind !== 'break') : []
    put(next, true)
    setShown(made.length ? made.slice(0, 3) : null)
  }
  const resolve = res => { const { F: f, g: was } = now.current; setPlaying(null); after(driver.resolveMoment(f, res), was.plays.length) }
  // (a call is only the decision: the play it makes is the engine's next one, so that one is run and shown as the call's result)
  const pick = id => {
    sfx('tap')
    const { F: f, g: was } = now.current
    let next = driver.resolveCall(f, id), ng = driver.view(next)
    if (ng && !ng.pending && !ng.done && ng.plays.length === was.plays.length) next = driver.step(next)
    after(next, was.plays.length)
  }
  const skip = () => { sfx('tap'); setPlaying(null); setShown(null); put(driver.skip(now.current.F), true) }

  const m = stop?.type === 'moment' ? stop : null
  return (
    <div className="frgd-live">
      <Scorebug g={g} title={!!title} />
      <div className="frgd-live-cols">
        <Scoring g={g} />
        {shown ? <Result g={g} shown={shown} />
          : m ? <Moment m={m} />
          : stop?.type === 'call' ? <Call c={stop} onPick={pick} />
          : <div className="frgd-log" ref={logRef}><DriveLog g={g} /></div>}
      </div>
      {shown ? <div className="frgd-foot"><div className="frgd-wrap"><button type="button" className="frgd-btn frgd-btn--main" onClick={() => { sfx('tap'); setShown(null) }}>CONTINUE</button></div></div>
        : m ? (
          <div className="frgd-foot"><div className="frgd-wrap">
            {m.mg && GAMES[m.mg.game] && <button type="button" className="frgd-btn frgd-btn--main" onClick={() => { sfx('whistle'); setPlaying(m) }}>PLAY IT</button>}
            <button type="button" className="frgd-btn frgd-btn--line" onClick={() => { sfx('tap'); resolve(null) }}>SIM THIS ONE</button>
          </div></div>
        ) : null}
      {!g.done && !shown && !stop && <button type="button" className="frgd-skip" onClick={skip}><IconFF /><span>SKIP</span></button>}
      {playing?.mg && (
        <MgStage key={playing.id} {...playing.mg} def={GAMES[playing.mg.game]} cast={playing.mg.cast ?? driver.cast?.(F) ?? null}
          onDone={res => {
            // (the mini game's own verdict, as MiniGame.jsx reads it: its call, or a perfect run, or half the score)
            const perfect = !!res.raw && res.raw.of > 0 && res.raw.made === res.raw.of, score = Math.max(0, Math.min(1, res.score ?? (res.hit ? 1 : 0)))
            resolve({ hit: perfect || (res.hit ?? score >= 0.5), score, raw: res.raw ?? null })
          }} />
      )}
    </div>
  )
}
