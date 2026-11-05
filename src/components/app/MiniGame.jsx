import { useEffect, useRef, useState } from 'react'
import { GAMES, traitValue } from '../../lib/minigames'
import { engineFor, BUCKET_GAMES } from '../../lib/mg'
import { byV } from '../../lib/mg/kit'
import { seeded } from '../../lib/rng'
import { momentSituation } from '../../lib/situations'
import { valToGrade } from '../../utils/simulation'
import { sfx } from '../../lib/juice'
import { IS_APP } from '../../lib/platform'
import WatchVideo from './WatchVideo'
import { REWARDED_ON } from '../../lib/rewardedAd'
import MgStage from './MgStage'

// The quick skill games. <MiniGame game build seed onDone /> shows the card, plays the game on its
// own full-screen stage (MgStage) and reports { score, hit, note, raw, out }. The games themselves
// are in lib/mg/. A test can finish any game through window.__bapMini.finish(score).
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// practice and camp have no playoff game behind them: these games still need a score, so they get one that fits
const NEEDS_SCORE = new Set(['two-minute', 'clutch-shot', 'goal-line'])

// retry (Career, app): a miss can be played again for a video, once
// labV (the test lab): plays at this grade instead of the build's
// sim (Career's Mini Games switch): no game, the trait decides, about as an average player would do
export default function MiniGame({ home = 'team', superBowl = null, game, build, seed = 'x', onDone, autoStart = false, hard = false, retry = false, lock = null, team = null, opp = null, pos = null, cast = null, situation = null, labV = null, sim = false, onSkipAll = null, children = null }) {
  const def = GAMES[game]
  const [stage, setStage] = useState(autoStart ? 'play' : 'intro')
  const [result, setResult] = useState(null)
  const [tries, setTries] = useState(0)          // replays bought with a video (one at most)
  const offerRetry = REWARDED_ON && retry && IS_APP && tries === 0
  // hard (training camp): played as if the trait were a notch or two lower (70%), so a
  // maxed build still has to earn it. The header shows the real grade, never the handicap.
  const real = labV ?? traitValue(game, build)
  // a mercy rule: each miss in a row at this game plays the next one about 3/4 of a grade
  // easier (two at most); a make resets it. The header still shows the real grade.
  const missKey = `bap_mg_miss_${game}`
  const [ease] = useState(() => { if (labV != null) return 0; try { return Math.min(2, Number(localStorage.getItem(missKey)) || 0) } catch { return 0 } })
  const v = Math.min(11, (hard ? Math.max(1, real * 0.7) : real) + ease * 0.75)
  const lockKey = lock ? `bap_mg_${lock}` : null
  const unlock = () => { if (lockKey) try { localStorage.removeItem(lockKey) } catch {} }
  const done = r => {
    if (result) return
    const perfect = !!r.raw && r.raw.of > 0 && r.raw.made === r.raw.of
    // the game's own call decides (camp is already tougher through the handicap above)
    const out = { score: clamp(r.score, 0, 1), hit: perfect || (r.hit ?? r.score >= 0.5), note: r.note ?? null, raw: r.raw ?? null, out: !!r.out }
    if (labV == null) try { if (out.hit) localStorage.removeItem(missKey); else localStorage.setItem(missKey, String(Math.min(2, ease + 1))) } catch {}
    setResult(out); setStage('done')
    // a miss that can still be replayed waits for the player's call
    if (!out.hit && offerRetry) return
    unlock(); onDone?.(out)
  }
  // Career (lock): a drill that was started and never finished (a reload, a closed app) is a
  // miss. The game is seeded, so replaying it after a reload was a free practice run
  // (turned off from the card itself, this moment simulates too)
  useEffect(() => {
    if (!sim) return
    unlock()
    const hit = seeded(`mg-sim-${seed}`)() < byV(v, 0.45, 0.92)
    onDone?.({ score: hit ? 0.7 : 0.3, hit, note: null, raw: null, out: false })
  }, [sim]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sim || !lockKey) return
    let left = false
    try { left = !!localStorage.getItem(lockKey) } catch {}
    if (left) { unlock(); onDone?.({ score: 0, hit: false, note: 'Left before it finished: counted as a miss', raw: null, out: false }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!sim && lockKey && stage === 'play') try { localStorage.setItem(lockKey, '1') } catch {} }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  // a test hook for the dev server only (a live build has no way to force a score)
  const doneRef = useRef(done); doneRef.current = done
  useEffect(() => { if (!import.meta.env.DEV) return; window.__bapMini = { finish: s => doneRef.current({ score: s, hit: s >= 0.5 }) }; return () => { delete window.__bapMini } }, [])
  if (!def || sim) return null
  const engine = engineFor(game)
  const shown = situation ?? (NEEDS_SCORE.has(game) ? momentSituation(game, seed, { us: team?.short ?? 'HOME', them: opp?.short && opp.short !== team?.short ? opp.short : 'AWAY' }) : null)
  const sport = BUCKET_GAMES.has(game) ? 'bucket' : 'nfl'
  const how = engine?.how?.[`${game}:${pos}`] ?? engine?.how?.[game] ?? def.how
  // (the traits this player has: the 40's list covers a QB's Legs and a lineman's Get Off, the cone's four positions)
  const owned = build ? def.traits.filter(t => build[t]) : []
  const traitNames = (owned.length ? owned : def.traits).slice(0, 2).map(t => t.replace(/([A-Z])/g, ' $1').replace('-', ' ')).join(' · ').toUpperCase()
  return (
    <div className={`mg${result ? (result.hit ? ' is-hit' : ' is-miss') : ''}`}>
      <div className="mg-head"><span className="ag-eyebrow">{def.title}</span><span className="mg-trait">{traitNames} · {valToGrade(real)}{hard && <i className="mg-hard">CAMP · TOUGHER</i>}</span></div>
      {stage === 'intro' && (
        <div className="mg-intro">
          <p>{how}</p>
          <button className="ag-btn ag-btn--gold" onClick={() => { setStage('play'); sfx('whistle') }}>READY</button>
          {onSkipAll && <button className="ag-btn ag-btn--ghost mg-skipall" onClick={() => { sfx('tap'); onSkipAll() }}>TURN OFF KEY MOMENTS</button>}
        </div>
      )}
      {stage === 'play' && <MgStage key={tries} home={home} superBowl={superBowl} game={game} def={def} v={v} arm={labV ?? traitValue('bomb', build)} seed={tries ? `${seed}-again` : seed} sport={sport} team={team} opp={opp} pos={pos} cast={cast} situation={shown} onDone={done}>{children}</MgStage>}
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
