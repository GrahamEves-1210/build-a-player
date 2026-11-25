import { useState, useEffect, useRef } from 'react'
import { LiveBoard, SpeedSeg, TimerBar, readable, reducedMotion, GamesSwitch } from './simFlow'
import { BoxSheet } from './app/SquadSeason'
import { matchStory, extendStory } from '../lib/soccerMatch'
import { sfx } from '../lib/juice'

// ═════════════════════════════════════════════════════════════════════════════
// Soccer's match day (SoccerSimPage): every match he plays, played in front of him, one at a time, the way football's
// and basketball's live games are (simFlow.jsx LiveBoard, SpeedSeg, TimerBar; the box score is SquadSeason.jsx's
// BoxSheet). The match is the engine's (utils/soccerSimulation.js); lib/soccerMatch.js tells it minute by minute.
//   MatchCentre: one match: the line-up note before it, the clock 0'-90' (+ stoppage, extra time, the shootout kick by
//   kick), the score as the goals go in, his line, the commentary; at full time his line, the box score, what the
//   page puts under it (the table, the other results) and the button to the next one.
//   PlaySwitch: how the matches play (every match live, or the results only).
// The striker is the username (userName), never "You".
// Styling: app-game.css (smd-*), the scoreboard's plf-* (index.css).
// ═════════════════════════════════════════════════════════════════════════════

// Slow / Normal / pause / Fast: the clock's beat (one a minute) in ms is BEAT × the speed; a goal holds the clock
const BEAT = 120
export const SOCCER_SPEEDS = [[2.2, 'Slow'], [1, 'Normal'], 'pause', [0.4, 'Fast']]
const SPEED_KEY = 'bap_soccer_speed', PLAY_KEY = 'bap_soccer_play'
export const readSpeed = () => { try { const v = Number(localStorage.getItem(SPEED_KEY)); return [2.2, 1, 0.4].includes(v) ? v : 1 } catch { return 1 } }
export const keepSpeed = v => { try { localStorage.setItem(SPEED_KEY, String(v)) } catch {} }
export const readPlay = () => { try { return localStorage.getItem(PLAY_KEY) === 'quick' ? 'quick' : 'live' } catch { return 'live' } }
const keepPlay = v => { try { localStorage.setItem(PLAY_KEY, v) } catch {} }

// how the matches play: every one live, or the results only (the moments still stop it)
export function PlaySwitch({ mode, onPick, what = 'match' }) {
  return (
    <GamesSwitch mode={mode} modes={[['live', `EVERY ${what.toUpperCase()} LIVE`], ['quick', 'RESULTS ONLY']]} onPick={m => { keepPlay(m); onPick(m) }}
      title="MATCH DAY" cls={{ root: 'smd-switch', top: 'smd-switch-top', group: 'smd-switch-seg' }} />
  )
}

// ── The clock ─────────────────────────────────────────────────────────────────
// i: the beat on the clock (-1 before kick-off); n: events out; pk: shootout kicks taken. `hold`: stop at the story's
// cap (a moment's minute) and call onHold; a new story (the moment played) carries on from the same beat.
function useMatchClock({ story, speed, paused, onHold, onDone, skip }) {
  const [s, setS] = useState({ i: -1, n: 0, pk: 0, phase: 'pre' })
  const last = story.beats.length - 1
  const hold = useRef(onHold); hold.current = onHold
  const done = useRef(onDone); done.current = onDone
  const held = useRef(false)
  // skip: straight to the final whistle (and through the shootout)
  useEffect(() => {
    if (!skip) return
    setS({ i: last, n: story.events.length, pk: story.shootout?.kicks.length ?? 0, phase: 'post' })
  }, [skip]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (s.phase === 'post') { const t = setTimeout(() => done.current?.(), 300); return () => clearTimeout(t) }
    if (paused) return undefined
    const rm = reducedMotion()
    if (s.phase === 'pre') { const t = setTimeout(() => setS(x => ({ ...x, phase: 'live' })), rm ? 0 : 700); return () => clearTimeout(t) }
    if (s.phase === 'pens') {
      const kicks = story.shootout?.kicks ?? []
      if (s.pk >= kicks.length) { const t = setTimeout(() => setS(x => ({ ...x, phase: 'post' })), 900 * Math.max(0.6, speed)); return () => clearTimeout(t) }
      const t = setTimeout(() => { setS(x => ({ ...x, pk: x.pk + 1 })); sfx('tap') }, (s.pk === 0 ? 1300 : 1050) * Math.max(0.5, speed))
      return () => clearTimeout(t)
    }
    // live
    if (story.cap != null && s.i >= story.cap) { if (!held.current) { held.current = true; hold.current?.() } return undefined }
    if (s.i >= last) { const t = setTimeout(() => setS(x => ({ ...x, phase: story.shootout ? 'pens' : 'post' })), 600 * speed); return () => clearTimeout(t) }
    // the beat just shown: a goal holds the clock, a whistle a little
    const evs = story.events
    let wait = BEAT * speed
    const justNow = evs.filter(e => e.b === s.i)
    if (justNow.some(e => e.kind === 'goal' || e.kind === 'moment')) wait += 1300 * Math.max(0.45, speed)
    else if (justNow.some(e => e.kind === 'ht' || e.kind === 'ft90' || e.kind === 'etht')) wait += 900 * Math.max(0.45, speed)
    else if (justNow.some(e => e.his)) wait += 450 * Math.max(0.45, speed)
    const t = setTimeout(() => {
      setS(x => {
        const i = x.i + 1
        let n = x.n
        while (n < evs.length && evs[n].b <= i) n++
        if (n > x.n && evs.slice(x.n, n).some(e => e.kind === 'goal')) sfx(evs.slice(x.n, n).some(e => e.kind === 'goal' && e.side === 'me') ? 'chime' : 'tap')
        return { ...x, i, n }
      })
    }, rm ? 0 : wait)
    return () => clearTimeout(t)
  }, [s, speed, paused, story]) // eslint-disable-line react-hooks/exhaustive-deps
  // a new story (a moment played): carry on
  useEffect(() => { if (story.cap == null) held.current = false }, [story])
  return s
}

function FeedRow({ e, beats, themHome = false }) {
  const lbl = beats[e.b]?.lbl ?? ''
  const cls = `smd-ev is-${e.kind}${e.his ? ' is-his' : ''}${e.side === 'opp' ? ' is-opp' : ''}`
  return (
    <li className={cls}>
      <span className="smd-ev-min">{e.kind === 'ht' ? 'HT' : e.kind === 'ft' ? 'FT' : lbl}</span>
      <span className="smd-ev-mark" aria-hidden="true">{e.kind === 'goal' ? <i className="smd-ball" /> : e.kind === 'yellow' ? <i className="smd-card" /> : null}</span>
      <span className="smd-ev-txt">
        {e.kind === 'goal' && <b className="smd-ev-score">{themHome ? `${e.opp}–${e.my}` : `${e.my}–${e.opp}`}</b>}
        {e.text}
      </span>
    </li>
  )
}

// a crest (the page's own, handed in)
// ── One match ─────────────────────────────────────────────────────────────────
// item: { m (the engine's match), label ("MATCHDAY 3"), kicker (the competition line), before ([his, theirs] first leg),
// final (the final: an occasion), tieLine (two legs: the aggregate line under the result) }
// ctx: { userName, pool, us, them (team objects: short, name, color, color2, att, def), crest (short, size) => node, key }
export function MatchCentre({ item, ctx, play, speed, paused, onSpeed, onPause, onNext, nextLabel = 'Next match', after = null, moment = null, outcome = null, onHeld = null, simAll = null, autoNext = true, onFullTime = null }) {
  // (the match as it kicked off: a moment rewrites it part way, outcome.to, and the story carries on from there)
  const m0 = useRef(item.m).current
  const m = outcome?.to ?? m0
  const { userName = 'Guest', pool, us, them, crest } = ctx
  const N = userName || 'Guest'
  const [story, setStory] = useState(() => matchStory(m0, {
    key: ctx.key, userName: N, pool, us: us.short, them: them.short, usName: us.name, themName: them.name,
    usRate: us, themRate: them, before: item.before ?? null, cap: item.cap ?? null,
  }))
  // a moment played (the director rewrote the match): the rest of it goes on from the moment's minute
  useEffect(() => {
    if (!outcome?.to) return
    setStory(s => extendStory(s, m0, outcome.to, { key: ctx.key, userName: N, usName: us.name, themName: them.name, themHome: !m0.home && !m0.neutral }, outcome.line))
  }, [outcome?.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const quick = play === 'quick'
  const [stage, setStage] = useState(quick ? 'ft' : 'pre')   // pre · live · ft
  // (full time: the page counts the result in its record at the same moment the table takes it)
  const ftRef = useRef(onFullTime); ftRef.current = onFullTime
  useEffect(() => { if (stage === 'ft') ftRef.current?.() }, [stage])
  const [skip, setSkip] = useState(0)
  const [box, setBox] = useState(false)
  const shown = useRef(false)
  useEffect(() => {
    if (stage !== 'pre') return undefined
    const t = setTimeout(() => setStage('live'), item.final ? 3200 : reducedMotion() ? 0 : 1700)
    return () => clearTimeout(t)
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  const clock = useMatchClock({ story, speed, paused: paused || stage !== 'live' || !!moment, skip, onHold: () => onHeld?.(), onDone: () => { if (!shown.current) { shown.current = true; setStage('ft') } } })
  const ft = stage === 'ft'
  const i = ft ? story.beats.length - 1 : clock.i
  const evs = ft ? story.events : story.events.slice(0, clock.n)
  const pk = ft ? (story.shootout?.kicks.length ?? 0) : clock.pk
  const lastGoal = [...evs].reverse().find(e => e.kind === 'goal')
  const my = lastGoal?.my ?? 0, op = lastGoal?.opp ?? 0
  const kicks = story.shootout?.kicks.slice(0, pk) ?? []
  const lastKick = kicks[kicks.length - 1]
  const beat = story.beats[Math.max(0, i)]
  const period = beat?.p ?? 1
  const inPens = !ft && clock.phase === 'pens'
  // the scoreboard (home on the right; a neutral ground puts his side on the left)
  const res = m.shootout ? (m.shootout.won ? 'W' : 'L') : m.result
  const sideOf = (t, score, extra = false) => ({ short: t.short, color: readable(t.color, t.color2, '#e4e4e7'), logo: crest(t.short, 52, 'plf-team-logo-img', extra), score })
  const me = sideOf(us, my), they = sideOf(them, op, !!m.oppExtra)
  const homeMe = !!m.home && !m.neutral
  const [away, home] = homeMe ? [they, me] : [me, { ...they, neutral: !!m.neutral }]
  const pensLine = story.shootout ? `${story.shootout.my}–${story.shootout.opp} on penalties` : ''
  // the line under the score: FT and the score as the board reads it (left side first), extra time and penalties after
  const post = m.shootout ? `FT · ${pensLine}` : m.et ? 'FT · after extra time' : 'FT'
  const ftScore = homeMe ? `${m.oppSc}–${m.mySc}` : `${m.mySc}–${m.oppSc}`
  const live = stage === 'live' && !ft
  const statusTxt = inPens ? 'PENALTIES' : clock.phase === 'pre' ? 'KICK-OFF' : period === 1 ? '1ST HALF' : period === 2 ? '2ND HALF' : 'EXTRA TIME'
  const nP = story.len > 90 ? 4 : 2
  // his line so far
  const his = evs.filter(e => e.his || e.byHim)
  const hg = his.filter(e => e.kind === 'goal' && e.his).length, ha = his.filter(e => e.byHim).length
  const hs = his.filter(e => (e.kind === 'goal' && e.his && e.gk !== 'pen') || e.kind === 'shot').length
  const hsot = his.filter(e => (e.kind === 'goal' && e.his && e.gk !== 'pen') || (e.kind === 'shot' && e.saved)).length
  const dnp = !m.app
  // (his minutes so far: on from story.on, off at story.off)
  const minsNow = m.app && clock.phase !== 'pre' ? Math.max(0, Math.min(beat?.m ?? 0, story.off ?? 0) - (story.on ?? 0)) : 0
  const why = { inj: 'injured', knock: 'a knock', bench: 'an unused substitute', rest: 'rested' }[m.why] ?? 'not involved'
  const feed = [...evs].reverse()
  const [allFeed, setAllFeed] = useState(false)
  const feedShown = allFeed || ft ? feed : feed.slice(0, 7)

  // the line-up note (and the final's walk-out)
  if (stage === 'pre') {
    return (
      <div className={`smd-pre${item.final ? ' is-final' : ''}`}>
        <span className="smd-pre-kicker">{item.kicker}</span>
        <span className="smd-pre-label">{item.final ? 'THE FINAL' : item.label}</span>
        <div className="smd-pre-teams">
          <span className="smd-pre-team">{crest(us.short, item.final ? 76 : 56)}<b>{us.name}</b></span>
          <span className="smd-pre-v">v</span>
          <span className="smd-pre-team">{crest(them.short, item.final ? 76 : 56, '', !!m.oppExtra)}<b>{them.name}</b></span>
        </div>
        {item.beforeLine && <span className="smd-pre-agg">{item.beforeLine}</span>}
        <span className="smd-pre-note">{dnp ? `${N} misses out: ${why}.` : m.start ? `${N} starts up front.` : `${N} starts on the bench.`}{m.neutral ? '' : m.home ? ' At home.' : ' Away from home.'}</span>
        <button type="button" className="smd-pre-go" onClick={() => setStage('live')}>KICK OFF</button>
      </div>
    )
  }
  const g = ft ? m.goals ?? 0 : hg
  return (
    <div className={`smd${item.final ? ' is-final' : ''}${ft ? ' is-ft' : ''}`}>
      <div className="smd-main">
      <LiveBoard sym="v" className="smd-board"
        label={item.label} away={away} home={home} phase={ft ? 'post' : 'live'}
        badge={res} badgeWin={res === 'W'}
        status={(
          <div className="plf-status-row">
            <div className="plf-qtr-dots">{Array.from({ length: nP }, (_, k) => <div key={k} className={`plf-qtr-dot${k < period - 1 || inPens ? ' plf-qd-done' : k === period - 1 ? ' plf-qd-active' : ''}`} />)}</div>
            <div className="plf-clock-box"><span className="plf-qtr-lbl">{statusTxt}</span><span className="plf-clk-sep">·</span><span className="plf-clock-time">{inPens ? `${lastKick ? `${lastKick.my}–${lastKick.opp}` : '0–0'}` : clock.phase === 'pre' ? "0'" : beat?.lbl}</span></div>
          </div>
        )}
        progress={inPens ? 1 : Math.max(0, i) / Math.max(1, story.beats.length - 1)}
        evt={live ? (inPens ? lastKick?.text ?? 'The shootout' : lastGoal ? `${story.beats[lastGoal.b]?.lbl} GOAL · ${lastGoal.his ? N : lastGoal.who ?? (lastGoal.side === 'me' ? us.name : them.name)}` : null) : null}
        post={post} postWin={res === 'D' ? null : res === 'W'} postScore={ftScore}
      />
      {story.shootout && (inPens || ft) && (
        <div className="smd-pens" aria-label="Penalty shootout">
          <span className="smd-pens-h">PENALTIES</span>
          {[['me', us], ['opp', them]].map(([side, t]) => (
            <div key={side} className="smd-pens-row">
              <span className="smd-pens-team">{crest(t.short, 18, '', side === 'opp' && !!m.oppExtra)}<b>{t.short}</b></span>
              <span className="smd-pens-kicks">
                {(() => {
                  // (five a side to come, then one at a time in sudden death: never how many there'll be)
                  const took = kicks.filter(k => k.side === side)
                  const n = ft ? Math.max(took.length, 1) : Math.max(5, took.length + (took.length >= 5 ? 1 : 0))
                  return Array.from({ length: n }, (_, j) => { const k = took[j]; return <i key={j} className={`smd-pk${k ? (k.scored ? ' is-in' : ' is-out') : ''}${k?.his ? ' is-his' : ''}`} title={k?.text ?? ''} /> })
                })()}
              </span>
              <b className="smd-pens-n">{kicks.filter(k => k.side === side && k.scored).length}</b>
            </div>
          ))}
          {lastKick && <p className={`smd-pens-last${lastKick.his ? ' is-his' : ''}`}>{lastKick.text}</p>}
        </div>
      )}
      <div className={`smd-his${dnp ? ' is-dnp' : ''}`}>
        <span className="smd-his-name">{N}</span>
        {dnp ? <span className="smd-his-dnp">Did not play: {why}</span> : (
          <span className="smd-his-cells">
            {[[g, g === 1 ? 'GOAL' : 'GOALS'], [ft ? m.assists ?? 0 : ha, 'AST'], [ft ? m.shots ?? 0 : hs, 'SHOTS'], [ft ? m.sot ?? 0 : hsot, 'ON TGT'], ft ? [m.rating != null ? (Math.round(m.rating * 10) / 10).toFixed(1) : '–', 'RATING'] : [minsNow, 'MIN']].map(([v, k]) => (
              <span key={k} className={k === 'RATING' && m.motm ? 'is-motm' : ''}><b>{v}</b><small>{k}</small></span>
            ))}
          </span>
        )}
      </div>
      {!ft && (
        <div className="smd-ctrl">
          <SpeedSeg speed={speed} paused={paused} steps={SOCCER_SPEEDS} onSpeed={v => { keepSpeed(v); onSpeed(v) }} onPause={onPause} onSkip={() => setSkip(x => x + 1)} skipLabel={['Skip to', 'Full time']} />
        </div>
      )}
      {moment}
      {ft && (
        <FullTime m={m} item={item} us={us} them={them} N={N} onBox={() => { setBox(true); sfx('tap') }} onNext={onNext} nextLabel={nextLabel} paused={paused || box} autoNext={autoNext} quick={quick} simAll={simAll} />
      )}
      </div>
      <div className="smd-side">
      {ft && after}
      <section className="smd-feed-sec">
        <h3 className="smd-h">{ft ? 'THE MATCH' : 'LIVE'}</h3>
        <ol className="smd-feed">{feedShown.filter(e => e.text).map((e, k) => <FeedRow key={`${e.b}-${e.kind}-${k}`} e={e} beats={story.beats} themHome={!m0.home && !m0.neutral} />)}</ol>
        {!ft && feed.length > 7 && <button type="button" className="smd-more" onClick={() => setAllFeed(a => !a)}>{allFeed ? 'Latest only' : `All ${feed.length} entries`}</button>}
      </section>
      </div>
      {box && <MatchBox m={m} story={story} item={item} us={us} them={them} N={N} logo={ctx.logo} onClose={() => setBox(false)} />}
    </div>
  )
}

// full time: the result in a line, his line, the box score, the next match
function FullTime({ m, item, N, onBox, onNext, nextLabel, paused, autoNext, quick, simAll }) {
  const pct = useTimerBar(!paused && autoNext, quick ? 1600 : 6500, onNext)
  const line = [m.goals ? `${m.goals} ${m.goals === 1 ? 'goal' : 'goals'}` : null, m.assists ? `${m.assists} ${m.assists === 1 ? 'assist' : 'assists'}` : null].filter(Boolean).join(', ')
  return (
    <div className="smd-ft">
      {item.tieLine && <p className="smd-ft-tie">{item.tieLine}</p>}
      {m.app ? <p className="smd-ft-line"><b>{N}</b>: {line || 'no goal'}{m.rating != null ? `, rated ${(Math.round(m.rating * 10) / 10).toFixed(1)}` : ''}{m.motm ? '. Player of the Match.' : '.'}</p> : null}
      <div className="smd-ft-btns">
        <button type="button" className="simp-cta smd-next" onClick={onNext}>{nextLabel}</button>
        <button type="button" className="smd-ghost" onClick={onBox}>Box score</button>
      </div>
      {autoNext && <TimerBar pct={pct} />}
      {simAll}
    </div>
  )
}
// (simFlow's timer bar, held while paused or the box score is open)
function useTimerBar(active, ms, onDone) {
  const [pct, setPct] = useState(0)
  const done = useRef(onDone); done.current = onDone
  const acc = useRef(0)
  useEffect(() => {
    if (!active) return undefined
    let t0 = Date.now()
    const iv = setInterval(() => {
      const now = Date.now(); acc.current += now - t0; t0 = now
      const p = Math.min(100, (acc.current / ms) * 100)
      setPct(p)
      if (p >= 100) { clearInterval(iv); done.current?.() }
    }, 50)
    return () => clearInterval(iv)
  }, [active, ms])
  return pct
}

// The box score: SquadSeason's sheet, with the match's team stats and both sides' men
function MatchBox({ m, story, item, us, them, N, onClose, logo }) {
  const scorers = side => {
    const by = new Map()
    for (const e of story.events) {
      if (e.side !== side) continue
      const add = (who, k) => { if (!who) return; const x = by.get(who) ?? { g: 0, a: 0, y: 0, his: who === N && side === 'me' }; x[k]++; by.set(who, x) }
      if (e.kind === 'goal') { add(e.who, 'g'); add(e.ast, 'a') }
      if (e.kind === 'yellow') add(e.who, 'y')
    }
    return [...by.entries()].filter(([n]) => !(n === N && side === 'me'))
  }
  const table = (side, idx) => {
    const own = idx === 0
    const rows = scorers(own ? 'me' : 'opp')
    return (
      <div className="bx-t smd-bx" role="table" aria-label="Players">
        <div className="bx-t-row bx-t-head" role="row"><span className="bx-t-k">Player</span><span>MIN</span><span>G</span><span>A</span><span>SH</span><span>RTG</span></div>
        {own && (
          <div className="bx-t-row is-mine" role="row">
            <span className="bx-t-name"><b>{N}</b><small>ST</small></span>
            {m.app ? [m.mins ?? 0, m.goals ?? 0, m.assists ?? 0, m.shots ?? 0, m.rating != null ? m.rating.toFixed(1) : '–'].map((c, k) => <span key={k}>{c}</span>) : <span className="smd-bx-dnp">DID NOT PLAY</span>}
          </div>
        )}
        {rows.map(([n, x]) => (
          <div key={n} className="bx-t-row" role="row">
            <span className="bx-t-name"><b>{n}</b><small>{x.y ? 'Booked' : ''}</small></span>
            <span>–</span><span>{x.g}</span><span>{x.a}</span><span>–</span><span>–</span>
          </div>
        ))}
        {!rows.length && !own && <p className="bx-none">No goals or assists.</p>}
      </div>
    )
  }
  const res = m.shootout ? `${m.mySc}–${m.oppSc} · ${m.shootout.my}–${m.shootout.opp} pens` : m.et ? 'after extra time' : ''
  const extra = m.app ? `${N}: ${m.goals ?? 0} G, ${m.assists ?? 0} A, ${m.shots ?? 0} shots (${m.sot ?? 0} on target), ${(m.xg ?? 0).toFixed(2)} xG${m.bcm ? `, ${m.bcm} big ${m.bcm === 1 ? 'chance' : 'chances'} missed` : ''}.` : `${N} didn't play.`
  return (
    <BoxSheet r={{ team: us.short, roster: [] }} sport="soccer" box={{ reg: [{ s: {}, us: {}, them: {} }] }} g={{ i: 0, opp: them.short, home: !!m.home && !m.neutral, vs: m.neutral || m.home ? 'v' : 'at', my: m.mySc, op: m.oppSc, where: item.label, oppName: them.name }}
      owner={N} onClose={onClose} rows={story.box.rows} status={`Full time${res ? ` · ${res}` : ''}`} story={extra}
      opp={{ r: { roster: [] }, game: { s: {} } }} table={table} nick={s => (s === us.short ? us.name : them.name)} logo={logo} className="smd-box" />
  )
}
