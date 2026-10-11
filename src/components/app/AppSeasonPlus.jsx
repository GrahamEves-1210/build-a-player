import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GAME_LINE, momentsOff, setMomentsOff } from '../../lib/seasonDirector'
import { leaderBoard } from '../../lib/seasonFacts'
import { sfx, haptic, victory } from '../../lib/juice'
import { IconArrow, IconStar, IconFlame } from './icons'

// Season reveal, the app version: the moment card the season pauses on, the
// matchup card for the game just played, the season pulse, the wire of
// headlines, milestones, league leaders, a stretch card for the 82-game year,
// and the season story on the final report.

const nick = opp => (opp || '').split(' ').slice(-1)[0]

// ── Moment: the season pauses here ──────────────────────────────────────────
// Moments on / off (the sim page's team card). Off: the season plays straight
// through, no decisions; the milestones and records still fire.
export function MomentsToggle() {
  const [off, setOff] = useState(() => momentsOff())
  return (
    <button className={`sts-moments${off ? ' is-off' : ''}`} onClick={() => { setMomentsOff(!off); setOff(!off); sfx('tap') }} aria-pressed={!off} title={off ? 'Turn the season\'s moments back on' : 'Play the season straight through, no decisions'}>
      <span className="sts-moments-knob" /><span>MOMENTS {off ? 'OFF' : 'ON'}</span>
    </button>
  )
}

export function MomentCard({ moment, onPick }) {
  const [picked, setPicked] = useState(null)
  const [outcome, setOutcome] = useState(null)
  // a moment that lands low on the screen comes up into view (clear of the dock / ad rail)
  const ref = useRef(null)
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [])
  const pick = o => {
    if (picked) return
    setPicked(o)
    const out = onPick(o)
    setOutcome(out)
    sfx(out ? (out.hit ? 'claim' : 'pop') : 'lock'); haptic('medium')
  }
  return (
    <div className="sm-moment ag-pop" ref={ref}>
      <span className="ag-eyebrow">{moment.kicker}</span>
      <h2 className="sm-moment-title">{moment.title}</h2>
      <p className="sm-moment-body">{moment.body}</p>
      <div className="sm-options">
        {moment.options.map(o => (
          <button key={o.id} className={`sm-option${picked ? (picked.id === o.id ? ' is-picked' : ' is-dim') : ''}`} onClick={() => pick(o)} disabled={!!picked}>
            <b>{o.label}</b><small>{o.sub}</small>
          </button>
        ))}
      </div>
      {/* a gamble shows how it landed; a straight choice speaks for itself */}
      {picked && outcome && (
        <div className={`sm-outcome ag-pop${outcome.hit ? ' is-hit' : ' is-miss'}`}>{outcome.line}</div>
      )}
    </div>
  )
}

// ── The game just played ────────────────────────────────────────────────────
export function NowCard({ game, pos, sport, team, logoFor, idx, total }) {
  if (!game) return null
  const line = GAME_LINE[pos]?.(game) ?? ''
  const opp = nick(game.opponent)
  return (
    <div key={game.wk ?? game.g} className={`sm-now${game.won ? ' is-w' : ' is-l'}${game.sat ? ' is-sat' : ''}`}>
      <div className="sm-now-top">
        <span className="ag-eyebrow">{sport === 'bucket' ? `GAME ${game.g}` : `WEEK ${game.wk}`} · {game.home ? 'HOME' : 'AWAY'}</span>
        <span className={`sm-now-badge${game.won ? ' is-w' : ' is-l'}`}>{game.won ? 'W' : 'L'}</span>
      </div>
      <div className="sm-now-match">
        <span className="sm-now-side"><img src={logoFor(team?.short)} alt="" /><b>{team?.short}</b></span>
        <span className="sm-now-score"><b>{game.mySc}</b><i>–</i><b>{game.oppSc}</b></span>
        <span className="sm-now-side"><img src={logoFor(game.opponent)} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden' }} /><b>{opp}</b></span>
      </div>
      <div className="sm-now-line">{game.sat ? 'Sat out: the team played without them' : line}</div>
      {game.tags?.length > 0 && <div className="sm-now-tags">{game.tags.map(t => <span key={t} className="sm-tag">{t}</span>)}</div>}
    </div>
  )
}

// ── Season pulse: games over .500, the playoff line, the current point ───────
export function Pulse({ games, total, playoffWins }) {
  const pts = useMemo(() => {
    let d = 0
    return games.map((g, i) => { d += g.won ? 1 : -1; return [i + 1, d] })
  }, [games])
  const W = 320, H = 72, pad = 6
  const maxAbs = Math.max(4, ...pts.map(p => Math.abs(p[1])))
  const x = i => pad + (i / total) * (W - pad * 2)
  const y = d => H / 2 - (d / maxAbs) * (H / 2 - pad)
  const path = pts.length ? 'M' + pts.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' L') : ''
  const last = pts[pts.length - 1]
  // the pace needed to reach the playoff line by season's end
  const needD = playoffWins * 2 - total
  return (
    <svg className="sm-pulse" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} className="sm-pulse-zero" />
      <line x1={pad} x2={W - pad} y1={y(needD)} y2={y(needD)} className="sm-pulse-po" />
      {path && <path d={path} className="sm-pulse-line" />}
      {last && <circle cx={x(last[0])} cy={y(last[1])} r="3.5" className="sm-pulse-dot" />}
    </svg>
  )
}

// ── Wire: headlines ─────────────────────────────────────────────────────────
export function Wire({ items }) {
  const [i, setI] = useState(0)
  useEffect(() => { setI(items.length - 1) }, [items.length])
  useEffect(() => { if (items.length < 2) return; const t = setInterval(() => setI(x => (x + 1) % items.length), 4200); return () => clearInterval(t) }, [items.length])
  if (!items.length) return null
  const it = items[Math.max(0, Math.min(i, items.length - 1))]
  return (
    <div className="sm-wire">
      <span className="sm-wire-tag">WIRE</span>
      <span key={it.text} className="sm-wire-text">{it.text}</span>
    </div>
  )
}

// ── Milestone chips that pop as they land ───────────────────────────────────
export function Milestones({ items }) {
  if (!items.length) return null
  return (
    <div className="sm-ms">
      {items.slice(-6).map(m => <span key={m.id} className={`sm-ms-chip${m.big ? ' is-big' : ''}${m.record ? ' is-rec' : ''}`}><IconStar size={11} /> {m.label}</span>)}
    </div>
  )
}

// A record falls: a full-screen beat
export function RecordOverlay({ record, name, onClose }) {
  useEffect(() => { victory({ big: true }); const t = setTimeout(onClose, 5200); return () => clearTimeout(t) }, []) // eslint-disable-line
  return createPortal(
    <div className="ag-ring sm-record" onClick={onClose}>
      <div className="ag-ring-rays" />
      <div className="ag-ring-inner">
        <span className="ag-eyebrow">ALL-TIME RECORD</span>
        <h2 className="ag-ring-title">{record.label}</h2>
        <span className="sm-record-num">{record.got}</span>
        <span className="ag-ring-score">was {record.value} · {record.holder}</span>
        <span className="ag-ring-count"><IconStar size={18} /> {name.toUpperCase()}</span>
      </div>
    </div>,
    document.body,
  )
}

// ── League leaders you slot into ────────────────────────────────────────────
export function Leaders({ sport, pos, pool, seed, you }) {
  const board = useMemo(() => leaderBoard({ sport, pos, pool, seed, you }), [sport, pos, pool, seed, you.value])
  if (!board) return null
  return (
    <div className="sm-leaders ag-pop">
      <div className="sm-leaders-head"><span className="ag-eyebrow">LEAGUE LEADERS · {board.label}</span><span className="sm-leaders-rank">{(you.name || 'Guest').toUpperCase()}: #{board.rank}</span></div>
      {board.rows.map((r, i) => (
        <div key={r.name} className={`sm-leader${r.me ? ' is-me' : ''}`}>
          <span className="sm-leader-n">{i + 1}</span>
          <span className="sm-leader-name">{r.name}<small>{r.team}</small></span>
          <span className="sm-leader-val">{typeof r.value === 'number' && !Number.isInteger(r.value) ? r.value.toFixed(1) : r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stretch card (basketball: the last ten games) ───────────────────────────
export function StretchCard({ games, from, to, pos }) {
  const slice = games.slice(from, to)
  if (!slice.length) return null
  const w = slice.filter(g => g.won).length
  const avg = k => (slice.reduce((s, g) => s + (g[k] ?? 0), 0) / slice.length).toFixed(1)
  const best = [...slice].sort((a, b) => b.pts - a.pts)[0]
  return (
    <div className={`sm-stretch${w >= slice.length - w ? ' is-w' : ' is-l'} ag-pop`}>
      <span className="ag-eyebrow">GAMES {from + 1}–{to}</span>
      <div className="sm-stretch-row">
        <span className="sm-stretch-rec"><b>{w}</b>–<b>{slice.length - w}</b></span>
        <span className="sm-stretch-stat"><b>{avg('pts')}</b><small>PPG</small></span>
        <span className="sm-stretch-stat"><b>{avg('reb')}</b><small>RPG</small></span>
        <span className="sm-stretch-stat"><b>{avg('ast')}</b><small>APG</small></span>
      </div>
      {best && <div className="sm-stretch-best">Best: {GAME_LINE[pos]?.(best)} {best.home ? 'vs' : '@'} {best.opponent}</div>}
    </div>
  )
}

// ── Season story (final report) ─────────────────────────────────────────────
export function SeasonStory({ story, pos, sport, name }) {
  if (!story) return null
  const { moments = [], milestones = [], records = [], headlines = [] } = story
  const top = headlines.slice(-3)
  return (
    <section className="sm-story ag-pop">
      <div className="sm-story-head"><span className="ag-eyebrow">SEASON STORY</span></div>
      {records.length > 0 && records.map(r => <div key={r.id} className="sm-story-rec"><IconStar size={14} /> <b>RECORD</b> {r.label}: {r.got} <small>(was {r.value}, {r.holder})</small></div>)}
      <div className="sm-story-timeline">
        {moments.map((m, i) => (
          <div key={i} className="sm-story-moment">
            <span className="sm-story-at">{m.stop.kind === 'playoffs' ? 'PLAYOFFS' : sport === 'bucket' ? `GM ${m.stop.at}` : `WK ${m.stop.at}`}</span>
            <span className="sm-story-txt"><b>{m.moment.title}</b> — {m.option.label}{m.outcome ? <i className={m.outcome.hit ? ' is-hit' : ' is-miss'}> · {m.outcome.hit ? 'paid off' : 'backfired'}</i> : null}</span>
          </div>
        ))}
        {moments.length === 0 && <div className="sm-story-moment"><span className="sm-story-at">—</span><span className="sm-story-txt">A straight run, no surprises.</span></div>}
      </div>
      {milestones.length > 0 && <div className="sm-ms">{milestones.map(m => <span key={m.id} className={`sm-ms-chip${m.big ? ' is-big' : ''}`}><IconStar size={11} /> {m.label}</span>)}</div>}
      {top.length > 0 && <div className="sm-story-wire">{top.map((h, i) => <div key={i}><span className="sm-wire-tag">WIRE</span> {h.text}</div>)}</div>}
    </section>
  )
}

// Hook: drives a director-based reveal. Returns everything a season screen
// needs to draw. `pace` ms per game; the reveal pauses at each stop.
export function useDirectedReveal({ director, pace, onFinal }) {
  const [k, setK] = useState(0)               // games revealed
  const [moment, setMoment] = useState(null)
  const [fresh, setFresh] = useState([])
  const [record, setRecord] = useState(null)
  const [tick, setTick] = useState(0)
  const [done, setDone] = useState(false)
  const stopIdx = useRef(0)
  const timer = useRef(null)
  const total = director?.total ?? 0

  useEffect(() => {
    if (!director || moment || done) return
    const stop = director.stops[stopIdx.current]
    const stopAt = stop ? stop.at : total
    if (k >= stopAt) {
      if (stop) {
        const m = director.open(stop)
        stopIdx.current++
        if (m) { setMoment(m); return }
        setTick(t => t + 1)   // no moment at this stop: run again for the next one
        return
      }
      if (!done) {
        const final = director.finalize()
        setDone(true)
        onFinal?.(final)
      }
      return
    }
    timer.current = setTimeout(() => {
      const next = k + 1
      const hits = director.observe(next)
      if (hits.length) {
        setFresh(f => [...f, ...hits])
        const rec = hits.find(h => h.record)
        if (rec) setRecord(director.records[director.records.length - 1])
        else if (hits.some(h => h.big)) { sfx('chime'); haptic('light') }
      }
      setK(next)
    }, k === 0 ? 700 : pace)
    return () => clearTimeout(timer.current)
  }, [k, moment, done, director, pace, tick]) // eslint-disable-line

  const choose = option => {
    const out = director.choose(moment, option)
    // let a gamble's outcome line read, then roll on
    setTimeout(() => { setMoment(null); setTick(t => t + 1) }, out ? 1900 : 700)
    return out
  }
  return { k, games: director ? director.games.slice(0, k) : [], moment, choose, fresh, record, clearRecord: () => setRecord(null), done, headlines: director?.headlines ?? [], total }
}
