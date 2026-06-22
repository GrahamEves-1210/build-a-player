import { useState, useEffect } from 'react'
import { ATTR, TYPES } from '../data/qbs'
import { valToGrade, getArchetype } from '../utils/simulation'
import QBAvatar from './QBAvatar'

// ── Helpers ──────────────────────────────────────────────────────────────────

function useCountUp(target, duration = 900, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled || !target) return
    const start = Date.now()
    let raf
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])
  return val
}

// ── Screen 1: Build Overview ──────────────────────────────────────────────────

function ScreenBuild({ result, build, types, onNext }) {
  const { ovr } = result
  const archetype = getArchetype(ovr, build, types)
  const ovrDisplay = useCountUp(ovr, 900)
  const [rowsVisible, setRowsVisible] = useState(0)
  const filled = types.filter(t => build[t])

  useEffect(() => {
    let i = 0
    const tick = () => {
      if (i >= filled.length) return
      i++
      setRowsVisible(i)
      setTimeout(tick, 80)
    }
    const t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="simp-screen">
      <div className="simp-ovr-hero">
        <div className="simp-ovr-num">{ovrDisplay || '–'}</div>
        <div className="simp-ovr-lbl">OVR</div>
      </div>
      <div className="simp-archetype">{archetype}</div>
      <button className="simp-cta" onClick={onNext}>Simulate Season</button>
      <div className="simp-attr-table">
        {filled.map((t, i) => {
          const meta = ATTR[t]
          const data = build[t]
          return (
            <div
              key={t}
              className={`simp-attr-row${i < rowsVisible ? ' simp-row-visible' : ''}`}
            >
              <QBAvatar photo={data.photo} team={data.team} color={data.teamColor} size={46} />
              <div className="simp-attr-info">
                <span className="simp-attr-name">{meta.label}</span>
                <span className="simp-attr-qb">{data.qbFull}</span>
              </div>
              <span className="simp-grade-circle" style={{ background: meta.hex, color: '#07120a' }}>
                {valToGrade(data.val)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Screen 2: Regular Season ──────────────────────────────────────────────────

function ScreenSeason({ result, onNext }) {
  const { games, seasonPassYds, seasonTDs, seasonINTs, seasonRating, playoffs } = result

  const [phase, setPhase]           = useState('loading')
  const [revealed, setRevealed]     = useState(0)
  const [liveWins, setLiveWins]     = useState(0)
  const [liveLosses, setLiveLosses] = useState(0)

  const allDone = revealed === games.length

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      setPhase('playing')
      let i = 0, w = 0, l = 0

      const revealNext = () => {
        if (i >= games.length) { setPhase('done'); return }
        const g = games[i]
        if (g.won) w++; else l++
        setRevealed(i + 1)
        setLiveWins(w)
        setLiveLosses(l)
        i++
        setTimeout(revealNext, 200)
      }

      revealNext()
    }, 900)

    return () => clearTimeout(loadTimer)
  }, [])

  return (
    <div className="simp-screen">

      {phase === 'loading' && (
        <div className="simp-loading">
          <div className="simp-loading-dot" /><div className="simp-loading-dot" /><div className="simp-loading-dot" />
          <div className="simp-loading-lbl">Simulating season…</div>
        </div>
      )}

      {phase !== 'loading' && (
        <>
          <div className="simp-eyebrow">Regular Season</div>
          <div className="simp-live-record">
            <span className="slr-w">{liveWins}</span>
            <span className="slr-sep">–</span>
            <span className="slr-l">{liveLosses}</span>
          </div>
          {allDone && (
            <div className="simp-record-sub simp-record-sub-in">
              {playoffs ? 'Playoff Bound' : 'Missed the Playoffs'}
            </div>
          )}

          <div className="simp-games-list">
            {games.slice(0, revealed).map(g => (
              <div key={g.wk} className={`simp-game-row ${g.won ? 'sgr-w' : 'sgr-l'} sgr-in`}>
                <span className="sgr-wk">WK {g.wk}</span>
                <span className={`sgr-badge ${g.won ? 'sgr-badge-w' : 'sgr-badge-l'}`}>{g.won ? 'W' : 'L'}</span>
                <span className="sgr-opp">{g.opponent}</span>
                <span className="sgr-score">{g.mySc}–{g.oppSc}</span>
                <span className="sgr-stat">{g.passYds}<span className="sgr-unit">yds</span> {g.tds}<span className="sgr-unit">TD</span> {g.ints}<span className="sgr-unit">INT</span></span>
              </div>
            ))}
          </div>

          {allDone && (
            <div className="simp-totals simp-totals-in">
              <div className="simp-total-cell">
                <div className="simp-total-val">{seasonPassYds.toLocaleString()}</div>
                <div className="simp-total-lbl">Pass Yds</div>
              </div>
              <div className="simp-total-cell">
                <div className="simp-total-val">{seasonTDs}</div>
                <div className="simp-total-lbl">TDs</div>
              </div>
              <div className="simp-total-cell">
                <div className="simp-total-val">{seasonINTs}</div>
                <div className="simp-total-lbl">INTs</div>
              </div>
              <div className="simp-total-cell">
                <div className="simp-total-val">{seasonRating}</div>
                <div className="simp-total-lbl">Rating</div>
              </div>
            </div>
          )}

          {allDone && (
            <button className="simp-cta simp-cta-in" onClick={onNext}>
              {playoffs ? 'Enter Playoffs' : 'Season Summary'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Screen 3: Playoffs ────────────────────────────────────────────────────────

function ScreenPlayoffs({ result, onNext }) {
  const { wins, losses, playoffs, playoffRounds, sbResult } = result
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (!playoffs) return
    let i = 0
    const revealNext = () => {
      if (i >= playoffRounds.length) return
      setRevealed(i + 1)
      i++
      setTimeout(revealNext, 1600)
    }
    const t = setTimeout(revealNext, 600)
    return () => clearTimeout(t)
  }, [playoffs])

  if (!playoffs) {
    return (
      <div className="simp-screen simp-screen-center">
        <div className="simp-eyebrow">Postseason</div>
        <div className="simp-miss-icon">○</div>
        <div className="simp-miss-title">Missed the Playoffs</div>
        <div className="simp-miss-sub">
          {wins}–{losses}. Needed {9 - wins} more win{9 - wins !== 1 ? 's' : ''} to qualify.
        </div>
        <button className="simp-cta" onClick={onNext}>See Summary</button>
      </div>
    )
  }

  const champion = sbResult?.won
  const allDone  = revealed === playoffRounds.length

  return (
    <div className="simp-screen">
      <div className="simp-eyebrow">Playoffs</div>
      {allDone && (
        <div className={`simp-big-record simp-big-record-in ${champion ? 'simp-record-champ' : 'simp-record-elim'}`}>
          {champion ? 'Champions' : `Out — ${sbResult?.round}`}
        </div>
      )}
      <div className="simp-rounds-list">
        {playoffRounds.slice(0, revealed).map(r => (
          <div key={r.round} className={`simp-round-card ${r.won ? 'src-w' : 'src-l'} src-in`}>
            <div className="src-label">{r.round}</div>
            <div className="src-body">
              <span className={`src-badge ${r.won ? 'src-badge-w' : 'src-badge-l'}`}>{r.won ? 'W' : 'L'}</span>
              <span className="src-opp">vs {r.opponent}</span>
              <span className="src-score">{r.mySc}–{r.oppSc}</span>
            </div>
          </div>
        ))}
      </div>
      {allDone && (
        <button className="simp-cta simp-cta-in" onClick={onNext}>Final Report</button>
      )}
    </div>
  )
}

// ── Screen 4: Final Report ────────────────────────────────────────────────────

function ScreenFinal({ result, onReset, onBack }) {
  const { ovr, wins, losses, playoffs, sbResult, seasonPassYds, seasonTDs, seasonINTs, seasonRushYds, seasonRushTDs, seasonCompPct, seasonRating, bestGame } = result
  const champion = sbResult?.won
  const [show, setShow] = useState(false)

  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t) }, [])

  const yds     = useCountUp(seasonPassYds, 1200, show)
  const tds     = useCountUp(seasonTDs, 900, show)
  const ints    = useCountUp(seasonINTs, 900, show)
  const rushYds = useCountUp(seasonRushYds, 1000, show)

  return (
    <div className="simp-screen">
      <div className={`simp-final-banner ${champion ? 'sfb-champ' : playoffs ? 'sfb-elim' : 'sfb-miss'}`}>
        <div className="sfb-outcome">
          {champion ? 'Super Bowl Champion' : playoffs ? `Eliminated — ${sbResult?.round}` : 'Missed the Playoffs'}
        </div>
        <div className="sfb-sub">{wins}–{losses} Season · OVR {ovr}</div>
      </div>

      {champion && (
        <div className="simp-sb-box">
          <div className="simp-section-lbl">Super Bowl Performance</div>
          <div className="simp-totals">
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.passYds}</div>
              <div className="simp-total-lbl">Pass Yds</div>
            </div>
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.tds}</div>
              <div className="simp-total-lbl">TDs</div>
            </div>
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.ints ?? 0}</div>
              <div className="simp-total-lbl">INTs</div>
            </div>
            <div className="simp-total-cell">
              <div className="simp-total-val">{sbResult.rating}</div>
              <div className="simp-total-lbl">Rating</div>
            </div>
          </div>
        </div>
      )}

      <div className="simp-stat-section">
        <div className="simp-stat-group-lbl">Production</div>
        <div className="simp-totals">
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? yds.toLocaleString() : '–'}</div>
            <div className="simp-total-lbl">Pass Yds</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? tds : '–'}</div>
            <div className="simp-total-lbl">Pass TDs</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? rushYds.toLocaleString() : '–'}</div>
            <div className="simp-total-lbl">Rush Yds</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? result.seasonRushTDs : '–'}</div>
            <div className="simp-total-lbl">Rush TDs</div>
          </div>
        </div>
        <div className="simp-totals simp-totals-3" style={{ marginTop: 14 }}>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? `${seasonCompPct}%` : '–'}</div>
            <div className="simp-total-lbl">Comp%</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? ints : '–'}</div>
            <div className="simp-total-lbl">INTs</div>
          </div>
          <div className="simp-total-cell">
            <div className="simp-total-val">{show ? seasonRating : '–'}</div>
            <div className="simp-total-lbl">Rating</div>
          </div>
        </div>
      </div>

      {bestGame && (
        <div className="simp-best-game">
          <div className="simp-section-lbl">Best Game</div>
          <div className="simp-best-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">{bestGame.passYds} yds · {bestGame.tds} TD · {bestGame.ints} INT · {bestGame.rating} RTG</span>
          </div>
        </div>
      )}

      <div className="simp-final-actions">
        <button className="simp-cta" onClick={onReset}>New Build</button>
        <button className="simp-ghost" onClick={onBack}>Back to Build</button>
      </div>
    </div>
  )
}

// ── Progress Dots ─────────────────────────────────────────────────────────────

function ProgressDots({ screen, total }) {
  return (
    <div className="simp-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`simp-dot ${i === screen ? 'simp-dot-active' : i < screen ? 'simp-dot-done' : ''}`} />
      ))}
    </div>
  )
}

// ── SimPage ───────────────────────────────────────────────────────────────────

export default function SimPage({ result, build, types = TYPES, onBack, onReset, replay = false }) {
  const [screen, setScreen] = useState(replay ? 3 : 0)
  const next = () => { document.querySelector('.simp-page')?.scrollTo({ top: 0, behavior: 'instant' }); setScreen(s => s + 1) }

  const handleReset = () => { setScreen(0); onReset() }
  const handleBack  = () => { setScreen(0); onBack()  }

  const screens = [
    <ScreenBuild    key="build"    result={result} build={build} types={types} onNext={next} />,
    <ScreenSeason   key="season"   result={result} onNext={next} />,
    <ScreenPlayoffs key="playoffs" result={result} onNext={next} />,
    <ScreenFinal    key="final"    result={result} onReset={handleReset} onBack={handleBack} />,
  ]

  return (
    <div className="simp-page">
      <div className="simp-col">
        <div className="simp-top-bar">
          {screen > 0 && screen < screens.length - 1 && (
            <button className="simp-back-btn" onClick={() => setScreen(s => s - 1)}>← Back</button>
          )}
          <ProgressDots screen={screen} total={screens.length} />
        </div>
        {screens[screen]}
      </div>
    </div>
  )
}
