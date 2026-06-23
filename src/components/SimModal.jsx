import { useState } from 'react'
import { ATTR, TYPES } from '../data/qbs'
import { valToGrade } from '../utils/simulation'

// ── Screen 1: Build overview ──────────────────────────────────────────────────
function ScreenBuild({ result, build, types, onNext, onClose }) {
  const { ovr } = result
  return (
    <div className="sim-screen">
      <button className="sim-close-x" onClick={onClose} aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1 1l10 10M11 1L1 11"/>
        </svg>
      </button>
      <div className="sim-eyebrow">Your Frankenstein QB</div>
      <div className="sim-ovr-hero">
        <div className="sim-ovr-hero-num">{ovr}</div>
        <div className="sim-ovr-hero-lbl">OVR</div>
      </div>

      <div className="sim-attr-table">
        {types.filter(t => build[t]).map(t => {
          const meta = ATTR[t]
          const data = build[t]
          return (
            <div key={t} className="sim-attr-row">
              <span className="sim-attr-dot" style={{ background: meta.col }} />
              <span className="sim-attr-name">{meta.label}</span>
              <span className="sim-attr-qb">{data.qbFull}</span>
              <span className="sim-attr-grade" style={{ color: meta.col }}>{valToGrade(data.val)}</span>
            </div>
          )
        })}
      </div>

      <button className="sim-cta-btn" onClick={onNext}>Simulate Season</button>
    </div>
  )
}

// ── Screen 2: Regular season ──────────────────────────────────────────────────
function ScreenSeason({ result, onNext }) {
  const { wins, losses, games, seasonPassYds, seasonTDs, seasonINTs, seasonRating, playoffs } = result
  return (
    <div className="sim-screen">
      <div className="sim-screen-header">
        <div className="sim-eyebrow">Regular Season</div>
        <div className="sim-big-record">{wins}–{losses}</div>
        <div className="sim-record-sub">{playoffs ? 'Playoff Bound' : 'Missed the Playoffs'}</div>
      </div>

      <div className="sim-games-scroll">
        {games.map(g => (
          <div key={g.wk} className={`sim-game-row ${g.won ? 'sgr-w' : 'sgr-l'}`}>
            <span className="sgr-wk">WK {g.wk}</span>
            <span className={`sgr-badge ${g.won ? 'sgr-badge-w' : 'sgr-badge-l'}`}>{g.won ? 'W' : 'L'}</span>
            <span className="sgr-opp">{g.opponent}</span>
            <span className="sgr-score">{g.mySc}–{g.oppSc}</span>
            <span className="sgr-stat">{g.passYds}<span className="sgr-unit">yds</span> {g.tds}<span className="sgr-unit">TD</span> {g.ints}<span className="sgr-unit">INT</span></span>
          </div>
        ))}
      </div>

      <div className="sim-totals-strip">
        <div className="sim-total">
          <div className="sim-total-val">{seasonPassYds.toLocaleString()}</div>
          <div className="sim-total-lbl">Pass Yds</div>
        </div>
        <div className="sim-total">
          <div className="sim-total-val">{seasonTDs}</div>
          <div className="sim-total-lbl">TDs</div>
        </div>
        <div className="sim-total">
          <div className="sim-total-val">{seasonINTs}</div>
          <div className="sim-total-lbl">INTs</div>
        </div>
        <div className="sim-total">
          <div className="sim-total-val">{seasonRating}</div>
          <div className="sim-total-lbl">Rating</div>
        </div>
      </div>

      <button className="sim-cta-btn" onClick={onNext}>
        {playoffs ? 'View Playoffs' : 'Season Summary'}
      </button>
    </div>
  )
}

// ── Screen 3: Playoffs ────────────────────────────────────────────────────────
function ScreenPlayoffs({ result, onNext }) {
  const { wins, losses, playoffs, playoffRounds, sbResult } = result

  if (!playoffs) {
    return (
      <div className="sim-screen sim-screen-center">
        <div className="sim-eyebrow">Postseason</div>
        <div className="sim-miss-icon">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="22" cy="22" r="18"/>
            <path d="M15 15l14 14M29 15L15 29"/>
          </svg>
        </div>
        <div className="sim-miss-title">Missed the Playoffs</div>
        <div className="sim-miss-sub">
          {wins}–{losses}. A stronger build would've made the cut.
        </div>
        <button className="sim-cta-btn" onClick={onNext}>See Summary</button>
      </div>
    )
  }

  const champion = sbResult?.won
  return (
    <div className="sim-screen">
      <div className="sim-screen-header">
        <div className="sim-eyebrow">Playoffs</div>
        <div className={`sim-big-record ${champion ? 'sim-record-champ' : 'sim-record-elim'}`}>
          {champion ? 'Champions' : `Out — ${sbResult?.round}`}
        </div>
      </div>

      <div className="sim-rounds-list">
        {playoffRounds.map((r, i) => (
          <div key={r.round} className={`sim-round-card ${r.won ? 'src-w' : 'src-l'}`}>
            <div className="src-label">{r.round}</div>
            <div className="src-body">
              <span className={`src-badge ${r.won ? 'src-badge-w' : 'src-badge-l'}`}>{r.won ? 'W' : 'L'}</span>
              <span className="src-opp">vs {r.opponent}</span>
              <span className="src-score">{r.mySc}–{r.oppSc}</span>
            </div>
          </div>
        ))}
      </div>

      <button className="sim-cta-btn" onClick={onNext}>Final Report</button>
    </div>
  )
}

// ── Screen 4: Final report ────────────────────────────────────────────────────
function ScreenFinal({ result, onReset, onClose }) {
  const { ovr, wins, losses, playoffs, sbResult, seasonPassYds, seasonTDs, seasonINTs, seasonRating, bestGame } = result
  const champion = sbResult?.won

  return (
    <div className="sim-screen">
      <div className={`sim-final-banner ${champion ? 'sfb-champ' : playoffs ? 'sfb-elim' : 'sfb-miss'}`}>
        <div className="sfb-outcome">
          {champion ? 'Super Bowl Champion' : playoffs ? (sbResult?.round === 'Super Bowl' ? 'Lost Super Bowl' : `Eliminated — ${sbResult?.round}`) : 'Missed the Playoffs'}
        </div>
        <div className="sfb-sub">{wins}–{losses} Season · OVR {ovr}</div>
      </div>

      {champion && (
        <div className="sim-sb-box">
          <div className="sim-sb-label">Super Bowl Performance</div>
          <div className="sim-totals-strip">
            <div className="sim-total">
              <div className="sim-total-val">{sbResult.passYds}</div>
              <div className="sim-total-lbl">Pass Yds</div>
            </div>
            <div className="sim-total">
              <div className="sim-total-val">{sbResult.tds}</div>
              <div className="sim-total-lbl">TDs</div>
            </div>
            <div className="sim-total">
              <div className="sim-total-val">{sbResult.rating}</div>
              <div className="sim-total-lbl">Rating</div>
            </div>
          </div>
        </div>
      )}

      <div className="sim-final-section">
        <div className="sim-final-section-lbl">Season Stats</div>
        <div className="sim-totals-strip">
          <div className="sim-total">
            <div className="sim-total-val">{seasonPassYds.toLocaleString()}</div>
            <div className="sim-total-lbl">Pass Yds</div>
          </div>
          <div className="sim-total">
            <div className="sim-total-val">{seasonTDs}</div>
            <div className="sim-total-lbl">TDs</div>
          </div>
          <div className="sim-total">
            <div className="sim-total-val">{seasonINTs}</div>
            <div className="sim-total-lbl">INTs</div>
          </div>
          <div className="sim-total">
            <div className="sim-total-val">{seasonRating}</div>
            <div className="sim-total-lbl">Rating</div>
          </div>
        </div>
      </div>

      {bestGame && (
        <div className="sim-best-game">
          <div className="sim-final-section-lbl">Best Game</div>
          <div className="sim-best-game-body">
            <span className="sbg-week">Wk {bestGame.wk}</span>
            <span className="sbg-opp">vs {bestGame.opponent}</span>
            <span className="sbg-line">{bestGame.passYds} yds · {bestGame.tds} TD · {bestGame.ints} INT · {bestGame.rating} rating</span>
          </div>
        </div>
      )}

      <div className="sim-final-actions">
        <button className="sim-cta-btn" onClick={onReset}>New Build</button>
        <button className="sim-ghost-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────
function ProgressDots({ screen, total }) {
  return (
    <div className="sim-progress-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`sim-dot ${i === screen ? 'sim-dot-active' : i < screen ? 'sim-dot-done' : ''}`} />
      ))}
    </div>
  )
}

// ── Root modal ────────────────────────────────────────────────────────────────
export default function SimModal({ open, result, build, onClose, onReset, types = TYPES }) {
  const [screen, setScreen] = useState(0)

  if (!result) return null

  const next = () => setScreen(s => s + 1)

  const handleClose = () => { setScreen(0); onClose() }
  const handleReset = () => { setScreen(0); onReset() }

  const screens = [
    <ScreenBuild    key="build"    result={result} build={build} types={types} onNext={next} onClose={handleClose} />,
    <ScreenSeason   key="season"   result={result} onNext={next} />,
    <ScreenPlayoffs key="playoffs" result={result} onNext={next} />,
    <ScreenFinal    key="final"    result={result} onReset={handleReset} onClose={handleClose} />,
  ]

  return (
    <div
      className={`modal-overlay ${open ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="sim-modal">
        <ProgressDots screen={screen} total={screens.length} />
        <div className="sim-screens-wrap">
          {screens[screen]}
        </div>
        {screen > 0 && screen < screens.length - 1 && (
          <button className="sim-back-btn" onClick={() => setScreen(s => s - 1)}>← Back</button>
        )}
      </div>
    </div>
  )
}
