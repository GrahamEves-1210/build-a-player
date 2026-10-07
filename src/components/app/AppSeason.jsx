import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProgress, levelInfo, markLevelSeen, missionDef, careerRings, levelUnlocks } from '../../lib/progress'
import { IconRing, IconTarget, IconCheck, IconArrow } from './icons'

// App: the season reveal's extra beats, dropped into the existing sim pages —
//   <WeekStrip>      the regular season as a strip of weeks lighting up W / L
//   <Bracket>        the road to the Super Bowl, lit round by round
//   <RingCeremony>   full-screen title moment
//   <SeasonRewards>  the XP the season earned, the level bar and missions

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export function WeekStrip({ games, revealed }) {
  return (
    <div className="ag-weeks" style={{ gridTemplateColumns: `repeat(${Math.ceil(games.length / 2)}, 1fr)` }}>
      {games.map((g, i) => (
        <span key={g.wk ?? i} className={`ag-week${i < revealed ? (g.won ? ' is-w' : ' is-l') : ''}${i === revealed - 1 ? ' is-now' : ''}`}>
          <span className="ag-week-n">{g.wk ?? i + 1}</span>
          <span className="ag-week-r">{i < revealed ? (g.won ? 'W' : 'L') : ''}</span>
        </span>
      ))}
    </div>
  )
}

const STAGES = [
  { id: 'wc',  label: 'WILD CARD',  test: /wild/i },
  { id: 'div', label: 'DIVISIONAL', test: /divis/i },
  { id: 'cf',  label: 'CONF. FINAL', test: /conf|champ/i },
  { id: 'sb',  label: 'SUPER BOWL', test: /super/i },
]
export function Bracket({ rounds, gameIdx, status, hasBye }) {
  return (
    <div className="ag-bracket">
      {STAGES.map((st, i) => {
        const ri = rounds.findIndex(r => st.test.test(r.round) && !(st.id === 'cf' && /super/i.test(r.round)))
        const r = ri >= 0 ? rounds[ri] : null
        // The rounds are simulated up front, so a missing round would give the
        // result away — rounds ahead all look the same until the run is over.
        const ended = status === 'eliminated' || status === 'champion'
        let state = 'pending'
        if (!r) state = hasBye && st.id === 'wc' ? 'bye' : ended ? 'out' : 'pending'
        else if (ri < gameIdx || (ri === gameIdx && (status === 'between' || status === 'champion'))) state = r.won ? 'won' : 'lost'
        else if (ri === gameIdx && status === 'eliminated') state = 'lost'
        else if (ri === gameIdx) state = 'live'
        const nextUp = state === 'pending' && r && ri === gameIdx + 1 && status === 'between'
        return (
          <div key={st.id} className={`ag-bk is-${state}${st.id === 'sb' ? ' ag-bk--sb' : ''}`}>
            <span className="ag-bk-lbl">{st.label}</span>
            <span className="ag-bk-val">
              {state === 'bye' ? 'BYE' : state === 'won' || state === 'lost' ? `${r.mySc}-${r.oppSc}` : state === 'live' ? 'LIVE' : nextUp ? (r.opponent?.split(' ').slice(-1)[0] ?? 'NEXT').toUpperCase() : '—'}
            </span>
            {i < STAGES.length - 1 && <span className="ag-bk-link" />}
          </div>
        )
      })}
    </div>
  )
}

export function RingCeremony({ team, title, score, trophy = '/trophy.webp', onClose }) {
  const rings = useMemo(() => careerRings(), [])
  return createPortal(
    <div className="ag-ring" style={{ '--tc': team?.color || 'var(--ag-a1)', '--tc2': team?.color2 || '#000' }} onClick={onClose}>
      <div className="ag-ring-rays" />
      <div className="ag-ring-inner" onClick={e => e.stopPropagation()}>
        <span className="ag-eyebrow">{team?.name ?? 'Your team'}</span>
        <h2 className="ag-ring-title">{title}</h2>
        <img src={trophy} alt="" className="ag-ring-trophy" draggable={false} />
        {score && <span className="ag-ring-score">{score}</span>}
        <span className="ag-ring-count"><IconRing size={20} /> RING #{Math.max(1, rings)}</span>
        <button className="ag-btn ag-btn--gold ag-ring-btn" onClick={onClose}>CONTINUE</button>
      </div>
    </div>,
    document.body,
  )
}

function useCount(target, run, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf, t0
    const step = now => { t0 ??= now; const t = Math.min(1, (now - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - t, 3)))); if (t < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}

// `result` is the season on screen — the panel only shows that season's rewards
export function SeasonRewards({ result }) {
  const p = useProgress()
  const s = p.lastSeason && (!result || p.lastSeason.ref === result) ? p.lastSeason : null
  const [stage, setStage] = useState(0)    // 0 lines → 1 bar fills → 2 level-up callout
  const seenRef = useRef(false)
  useEffect(() => {
    if (!s) return
    const a = setTimeout(() => setStage(1), 300 + s.lines.length * 220)
    const b = setTimeout(() => setStage(2), 300 + s.lines.length * 220 + 1100)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [s?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const before = s ? levelInfo(s.before) : null
  const after = s ? levelInfo(s.after) : null
  const leveled = s && after.level > before.level
  useEffect(() => {
    // this panel shows the level-up itself, so the global overlay stays quiet
    if (stage >= 2 && leveled && !seenRef.current) { seenRef.current = true; markLevelSeen() }
  }, [stage, leveled])
  const total = useCount(s?.xp ?? 0, !!s)
  if (!s) return null
  const pct = stage >= 1 ? after.pct : (leveled ? 0 : before.pct)
  const unlocks = leveled ? levelUnlocks(after.level, before.level) : null

  return (
    <section className="ag-rewards">
      <div className="ag-rewards-head">
        <span className="ag-eyebrow">SEASON REWARDS</span>
        <span className="ag-rewards-total">+{total} <small>XP</small></span>
      </div>
      <div className="ag-rewards-lines">
        {s.lines.map((l, i) => (
          <div key={l.label} className="ag-rline" style={{ '--d': `${200 + i * 220}ms` }}>
            <span>{l.label}</span><b>+{l.xp}</b>
          </div>
        ))}
      </div>
      <div className="ag-rewards-level">
        <span className="ag-rewards-lvl">LVL {stage >= 1 ? after.level : before.level}</span>
        <span className="ag-xpbar ag-xpbar--big"><span style={{ width: `${Math.max(2, pct * 100)}%` }} /></span>
        <span className="ag-rewards-title">{stage >= 1 ? after.title : before.title}</span>
      </div>
      {leveled && stage >= 2 && (
        <div className="ag-rewards-up">
          <span className="ag-rewards-up-n">LEVEL {after.level}</span>
          <span className="ag-rewards-up-t">{after.title}{unlocks?.spots.length ? ` · ${unlocks.spots.map(s => s.name).join(' + ')} spotlight unlocked` : ''}</span>
        </div>
      )}
      {!p.signedIn && <div className="ag-rewards-note">Playing as a guest — <button onClick={() => window.dispatchEvent(new CustomEvent('bap:auth'))}>sign in</button> to keep your career.</div>}
      {s.missions?.length > 0 && (
        <div className="ag-rewards-missions">
          {s.missions.map(m => {
            const def = missionDef(m.id)
            if (!def) return null
            const cur = p.day?.missions.find(x => x.id === m.id)?.n ?? m.n
            const done = cur >= def.goal
            const moved = cur > m.before
            return (
              <div key={m.id} className={`ag-rm${done ? ' is-done' : ''}${moved ? ' is-moved' : ''}`}>
                <span className="ag-rm-icon">{done ? <IconCheck size={14} /> : <IconTarget size={14} />}</span>
                <span className="ag-rm-text">{def.text}</span>
                <span className="ag-rm-n">{Math.min(cur, def.goal)}/{def.goal}</span>
              </div>
            )
          })}
          {s.missions.some(m => (p.day?.missions.find(x => x.id === m.id)?.n ?? 0) >= (missionDef(m.id)?.goal ?? 1) && !p.day?.missions.find(x => x.id === m.id)?.claimed) && (
            <button className="ag-rewards-claim" onClick={() => nav('daily')}>CLAIM MISSION XP <IconArrow size={14} /></button>
          )}
        </div>
      )}
    </section>
  )
}
