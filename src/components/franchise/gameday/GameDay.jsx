import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { sfx, haptic } from '../../../lib/juice'
import * as engine from './bridge'
import Live from './Live'
import Postgame from './Postgame'
import { Logo, IconBack, barOf, nickOf, rankText, teamOf } from './parts'
import './gameday.css'

// FRANCHISE · GAME DAY. The week's game from the matchup to the box score:
//   pregame  → the matchup as a broadcast shows it, and three ways in: PLAY THE MOMENTS, WATCH, SIM
//   live     → the scorebug and the drive log, the engine's game stepped a play at a time (Live.jsx)
//   post     → the final, the box score, player of the game, XP, injuries, around the league (Postgame.jsx)
//   trophy   → a Super Bowl win: the trophy scene, when ../TrophyScene.jsx is there
// Props: franchise (the save), onFranchise(next) (every change handed back: the moments switch, and the finished
// game, the moment it ends), onDone() (the user leaves, back to the hub).
// The engine is reached only through bridge.js (`driver` swaps it out on the dev page, dev.jsx).

// (the trophy scene is another file's: found when it exists, nothing when it doesn't)
const trophyFile = import.meta.glob('../TrophyScene.jsx')['../TrophyScene.jsx']
const TrophyScene = trophyFile ? lazy(() => trophyFile().catch(() => ({ default: ({ onDone }) => { useEffect(() => { onDone?.() }, []); return null } }))) : null   // (it failed to load: straight on to the postgame)

function Unit({ row }) {
  const o = barOf(row.off.team), d = barOf(row.def.team)
  const w = rank => `${Math.max(6, ((33 - rank) / 32) * 100)}%`
  return (
    <div className="frgd-unit">
      <div className="frgd-unit-side" style={{ '--bar': o.color }}>
        <b>{rankText(row.off.rank)}</b><small>{row.off.val != null ? `${row.off.val} ${row.unit ?? 'YPG'}` : ''}</small>
        <i><u style={{ width: w(row.off.rank) }} /></i>
      </div>
      <div className="frgd-unit-mid">{row.label}</div>
      <div className="frgd-unit-side is-r" style={{ '--bar': d.color }}>
        <b>{rankText(row.def.rank)}</b><small>{row.def.val != null ? `${row.def.val} ${row.unit ?? 'YPG'}` : ''}</small>
        <i><u style={{ width: w(row.def.rank) }} /></i>
      </div>
    </div>
  )
}

function Pregame({ v, momentsOn, note, onMoments, onStart, onBack }) {
  const opp = v.user === v.home ? v.away : v.home
  const hurt = t => v.injuries.filter(x => x.team === t)
  return (
    <>
      <div className="frgd-top">
        <button type="button" className="frgd-top-back" aria-label="Back to the hub" onClick={onBack}><IconBack /></button>
        <b>{v.label}</b>
      </div>
      <div className="frgd-body">
        <div className="frgd-wrap">
          <div className={`frgd-mu${v.title ? ' plf-game--title' : ''}`}>
            {[v.away, v.home].map(t => (
              <div key={t} className="frgd-mu-side" style={{ '--bar': barOf(t).color }}>
                <Logo short={t} size={64} />
                <strong>{t}</strong>
                <span>{nickOf(t).toUpperCase()}</span>
                <em>{v.records?.[t] ?? ''}</em>
              </div>
            ))}
            <div className="frgd-mu-at">{v.neutral || v.title ? 'VS' : 'AT'}</div>
            {(v.venue || v.weather || v.line) && <div className="frgd-mu-where">{v.venue && <span>{v.venue.toUpperCase()}</span>}{v.weather?.text && <span>{v.weather.text}</span>}{v.line && <span>LINE {v.line}</span>}</div>}
          </div>
          <div className="frgd-cols">
            <div>
              {v.units.map(u => (
                <section className="frgd-sec" key={u.when}>
                  <div className="frgd-h"><i>{u.rows[0].off.team} OFFENSE</i><span>{v.projected ? 'PROJECTED' : `WHEN ${u.when} HAS THE BALL`}</span><i>{u.rows[0].def.team} DEFENSE</i></div>
                  {u.rows.map(r => <Unit key={r.label} row={r} />)}
                </section>
              ))}
            </div>
            <div>
              <section className="frgd-sec">
                <div className="frgd-h"><span>INJURY REPORT</span></div>
                {[v.user, opp].map(t => (
                  <div key={t}>
                    <div className="frgd-sub" style={{ '--bar': barOf(t).color }}>{t}</div>
                    {hurt(t).length ? hurt(t).map(x => (
                      <div className="frgd-row" key={x.name}><span>{x.pos}</span><b>{x.name}{x.note && <small>{x.note}</small>}</b><em className={x.status === 'OUT' || x.status === 'IR' ? 'is-out' : ''}>{x.status}</em></div>
                    )) : <div className="frgd-none">No one listed</div>}
                  </div>
                ))}
              </section>
              {!!v.keys?.length && (
                <section className="frgd-sec">
                  <div className="frgd-h"><span>KEYS TO THE GAME</span></div>
                  {v.keys.map((k, i) => <div className="frgd-row frgd-row--key" key={i}><span>{i + 1}</span><b>{k}</b></div>)}
                </section>
              )}
              {v.plan && (
                <section className="frgd-sec">
                  <div className="frgd-h"><span>GAMEPLAN</span></div>
                  <div className="frgd-row frgd-row--plan"><span>OFFENSE</span><b>{v.plan.off}</b></div>
                  <div className="frgd-row frgd-row--plan"><span>DEFENSE</span><b>{v.plan.def}</b></div>
                </section>
              )}
              <section className="frgd-sec">
                <div className="frgd-h"><span>GAME DAY</span></div>
                <button type="button" className="frgd-tog" role="switch" aria-checked={momentsOn} onClick={() => onMoments(!momentsOn)}>
                  <b>PLAY THE MOMENTS</b>
                  <span><i className={momentsOn ? '' : 'is-on'}>OFF</i><i className={momentsOn ? 'is-on' : ''}>ON</i></span>
                </button>
              </section>
            </div>
          </div>
          <div className="frgd-end" />
        </div>
      </div>
      <div className="frgd-foot">
        <div className="frgd-wrap">
          {note && <div className="frgd-note" role="status">{note}</div>}
          {momentsOn && <button type="button" className="frgd-btn frgd-btn--main" onClick={() => onStart('moments')}>PLAY THE MOMENTS</button>}
          <div className="frgd-foot-two">
            <button type="button" className={`frgd-btn ${momentsOn ? 'frgd-btn--line' : 'frgd-btn--main'}`} onClick={() => onStart('watch')}>WATCH</button>
            <button type="button" className="frgd-btn frgd-btn--line" onClick={() => onStart('sim')}>SIM</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function GameDay({ franchise, onFranchise, onDone, driver = engine }) {
  // The franchise is held here while Game Day is open: the engine's game rides in it, and it moves on every play.
  // It goes back up (onFranchise: the save) when something is decided: the switch, the kickoff, every stop and its
  // result, the final. Not on every play
  const [F, setF] = useState(franchise)
  const put = (next, save = true) => { setF(next); if (save) onFranchise?.(next) }
  // the matchup is read once, as the screen opens: the save moves on a week the moment the game is booked, and this
  // screen is still showing the game that was played
  const [pre] = useState(() => driver.pregame(franchise))
  const [momentsOn, setMomentsOn] = useState(() => !!pre?.momentsOn)
  // (a game already under way: a reload in the middle of one comes straight back to it)
  const [phase, setPhase] = useState(() => (driver.live(franchise) ? 'live' : 'pre'))
  const [result, setResult] = useState(null)
  const [note, setNote] = useState(null)
  const g = useMemo(() => (phase === 'live' ? driver.view(F) : null), [F, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const bar = barOf(pre?.user)

  const book = from => {
    const out = driver.finish(from)
    // a Super Bowl won: the trophy scene first (it plays its own sound), then the postgame
    const trophy = !!(out.result.won && out.result.title && TrophyScene)
    setResult(out.result); setPhase(trophy ? 'trophy' : 'post'); put(out.F)
    if (out.result.won) { if (!trophy) sfx(out.result.title ? 'champion' : 'award'); haptic('success') }
  }
  // the final whistle: a beat on the final score, then the postgame
  const over = phase === 'live' && !!g?.done
  useEffect(() => { if (!over) return; const t = setTimeout(() => book(F), 1300); return () => clearTimeout(t) }, [over]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = m => {
    sfx(m === 'sim' ? 'tap' : 'whistle')
    let next = driver.start(F, m)
    if (!driver.view(next)) { setNote(driver.flash?.(next)?.msg ?? 'This game can’t be played yet.'); return }
    if (m === 'sim') { if (!driver.view(next).done) next = driver.skip(next); book(next); return }
    put(next); setPhase('live')
  }
  const moments = on => { sfx('tap'); setMomentsOn(on); put(driver.setMoments(F, on)) }
  const leave = () => { sfx('tap'); onDone?.() }
  // (leaving in the middle of a mini game: the page under its stage comes back)
  useEffect(() => () => { document.documentElement.classList.remove('mg-live') }, [])

  // (the accent: the shell's own --fr-team when Game Day opens inside it, the same colour worked out here when not)
  const tone = { '--gd-team-own': bar.color, '--gd-ink-own': bar.ink }
  if (!pre) return (
    <div className="frgd" data-phase="none">
      <div className="frgd-top"><button type="button" className="frgd-top-back" aria-label="Back to the hub" onClick={() => onDone?.()}><IconBack /></button><b>GAME DAY</b></div>
      <div className="frgd-body"><div className="frgd-sec"><div className="frgd-none">No game this week</div></div></div>
    </div>
  )
  return (
    <div className={`frgd${pre.title ? ' is-title' : ''}`} style={tone} data-phase={phase}>
      {phase === 'pre' && <Pregame v={pre} momentsOn={momentsOn} note={note} onMoments={moments} onStart={start} onBack={() => { sfx('back'); onDone?.() }} />}
      {phase === 'live' && g && <>
        <div className="frgd-top"><span /><b>{pre.label}</b></div>
        <Live F={F} put={put} g={g} driver={driver} title={pre.title} />
      </>}
      {phase === 'post' && result && <>
        <div className="frgd-top"><span /><b>{pre.label}</b></div>
        <Postgame r={result} />
        <div className="frgd-foot"><div className="frgd-wrap"><button type="button" className="frgd-btn frgd-btn--main" onClick={leave}>CONTINUE</button></div></div>
      </>}
      {phase === 'trophy' && TrophyScene && (
        <Suspense fallback={null}>
          <TrophyScene team={teamOf(pre.user)} title="SUPER BOWL CHAMPIONS" line={[pre.year ? `${pre.year} season` : null, pre.records?.[pre.user] || null].filter(Boolean).join(' · ')} onDone={() => setPhase('post')} />
        </Suspense>
      )}
    </div>
  )
}

export { GameDay }
