import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, momentView, finishMoment, ROUNDS, CONF_OF, DIV_OF, SNAP_KIND, playsFor, PLAYS, playSetup, playResult, nameSnap, snapWord, simSnap, ctlFor } from '../../lib/franchise2'
import { gameBox } from '../../lib/franchise2/stats'
import { whenOf } from '../../lib/franchise2/plays'
import { seeded } from '../../lib/rng'
import { sfx, haptic, victory } from '../../lib/juice'
import { romanOf } from '../../lib/mg/kit'
import { minigameOpen } from '../../lib/ads'
import { SpeedSeg, MomentsToggle } from '../simFlow'
import { BoxSheet, FootballBox, FbTable } from '../app/SquadSeason'
import { fkVars, KLogo, Chyron, Scorebug, ManL3, Stamp, Go, Tag, Bumper, reduced, ActionBar } from './kit'
import { faceFor } from './dparts'
import './gameday.css'

const MgStage = lazy(() => import('../app/MgStage'))

// GAME DAY (owner, 2026-11-16): the player's game as a broadcast. The week's bar and the scorebug on top; under them
// the speed (SLOW, NORMAL, FAST, pause, SKIP) and the KEY MOMENTS switch; then the field (who has it, the down and
// distance, where the ball is, the drive so far) beside the play-by-play, the scoring and the box score. A moment stops
// the clock where the game put it (game.js snapOf): the player calls the play and runs it on the mini games' engines
// (moments.js), or plays the backer on defense, and the game goes on from what the snap did. FINAL: the score by
// quarter, the line under it, the builds' lines, the moments, and the box score.
//   start: { row } a finished game, or { pend: true } a game waiting on its moment (F.pend)
const GAME_MS = 32000                     // NORMAL: a game in about half a minute (it was under three seconds)
const SPEEDS = [[2, 'Slow'], 'pause', [1, 'Normal'], [0.4, 'Fast']]
const SPEED_KEY = 'bap_fr2_speed'
const readSpeed = () => { try { const v = Number(localStorage.getItem(SPEED_KEY)); return [2, 1, 0.4].includes(v) ? v : 1 } catch { return 1 } }
const keepSpeed = v => { try { localStorage.setItem(SPEED_KEY, String(v)) } catch { /* (private mode: the choice lasts the visit) */ } }
const DOWN = ['', '1ST', '2ND', '3RD', '4TH']
const nick = s => TEAM[s].nick.toUpperCase()
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

// ── The game's timeline: the scoring plays and the drives, to the end or to the moment it's waiting on ──────
function timelineOf(F, row, mv) {
  if (row) {
    const dr = row.dr ?? null
    return { opp: row.opp, home: row.home, po: row.rd != null, kp: row.kp ?? [], dr, endT: Math.max(3600, ...(row.pl ?? []).map(p => p[0]), ...(dr ?? []).map(d => d[1])), ms: row.ms ?? [], cur: null }
  }
  return { opp: mv.opp, home: mv.home, po: !!mv.po, kp: mv.feed ?? [], dr: mv.dr ?? [], endT: mv.t, ms: mv.ms ?? [], cur: mv.from ? [mv.from.t0, mv.t, mv.ball === 'us' ? 1 : 0, mv.from.y0, 'M', mv.y] : null }
}
// A drive's snaps as the broadcast shows them (the down, the distance, the spot), from where it started to how it
// ended. The game plays drives, not snaps; these are laid out along the drive (seeded, the same every time): the
// series it moved the chains on, and the last one, the one that ended it. end: the moment's own snap.
function driveSnaps(d, seed, end = null) {
  const [t0, t1, , y0, res, at0] = d
  const R = seeded(`${seed}-${t0}`)
  const int = (a, b) => (b <= a ? a : a + Math.floor(R() * (b - a + 1)))
  const at = res === 'T' ? 100 : Math.max(1, at0)
  const out = []
  const push = (down, togo, y) => out.push({ down, togo: Math.max(1, Math.min(togo, 100 - y)), y: Math.max(1, Math.min(99, y)), goal: y + togo >= 100 })
  if (res === 'K') { push(1, 10, y0); push(2, 10, y0); push(3, 10, y0) }
  else if (res === 'E' && t1 - t0 < 20) push(1, 10, y0)
  else {
    // the series that moved the chains, then the last one
    const lastStart = end ? Math.max(y0, end.y + end.d - 10) : null
    const stop = end ? lastStart : res === 'T' ? 100 : at
    let s = y0
    while (stop - s >= (end ? 1 : 10) + (res === 'T' ? 8 : 0)) {
      const to = end ? Math.min(stop, s + 10 + int(0, 6)) : s + 10 + int(0, Math.min(8, stop - s - 10))
      if (end && to > stop) break
      // 1st & 10, sometimes 2nd, sometimes 3rd, then the play that moves the chains
      const n = int(0, 2), g1 = int(1, 7), g2 = int(0, Math.max(0, 9 - g1))
      push(1, 10, s); if (n >= 1) push(2, 10 - g1, s + g1); if (n >= 2) push(3, 10 - g1 - g2, s + g1 + g2)
      s = to
      if (end && s >= stop) break
    }
    if (end) {
      s = Math.max(y0, Math.min(s, lastStart))
      for (let dn = 1; dn < end.down; dn++) { const y = s + Math.round(((end.y - s) * (dn - 1)) / Math.max(1, end.down - 1)); push(dn, s + 10 - y, y) }
      push(end.down, end.d, end.y)
    } else if (res === 'T') {
      push(1, Math.min(10, 100 - s), s)
      if (100 - s > 3) push(2, Math.min(10, 100 - s) - int(1, 3), s + int(1, 3))
    } else {
      // it ended here: third down short of the line, then fourth (the kick, or going for it); a turnover on any down
      const g = Math.min(9, at - s)
      push(1, 10, s)
      if (res === 'X') { if (g > 2) push(2, 10 - Math.floor(g / 2), s + Math.floor(g / 2)) }
      else { push(2, 10 - Math.max(0, Math.floor(g / 2)), s + Math.max(0, Math.floor(g / 2))); push(3, 10 - g, at); if (res !== 'E') push(4, 10 - g, at) }
    }
  }
  const n = out.length
  out.forEach((x, i) => { x.t = t0 + ((t1 - t0) * i) / n })
  return out
}
// where the game is at T: the drive on (who has it, the snap, how far it's come), or null between drives
function situationAt(T, tl, F) {
  const rows = tl.dr ?? []
  let d = rows.find(x => x[0] <= T && T < x[1])
  let end = null
  if (!d && tl.cur && T >= tl.cur[0]) { d = tl.cur; end = { down: tl.moment.down, d: tl.moment.d, y: tl.moment.y } }
  if (!d) return null
  // (a drive with one of the moments in it: up to the snap, the snap itself; after it, the drive from where it left
  // the ball: a new series past the line, fourth down short of it)
  const m = !end && (tl.ms ?? []).find(x => x.t >= d[0] && x.t < d[1])
  if (m && !m.to && !m.td) {
    if (T < m.t) { d = [d[0], m.t, d[2], d[3], 'M', m.y]; end = { down: m.down, d: m.d, y: m.y } }
    else {
      const ny = Math.max(1, Math.min(99, m.y + (m.yards ?? 0)))
      if ((m.yards ?? 0) >= m.d) d = [m.t + 6, d[1], d[2], ny, d[4], d[5]]
      else if (m.down === 3) { d = [m.t + 6, d[1], d[2], d[3], 'M', ny]; end = { down: 4, d: m.d - (m.yards ?? 0), y: ny } }
    }
  }
  const snaps = driveSnaps(d, `${F.seed}-${F.year}-${tl.opp}`, end)
  const k = snaps.filter(x => x.t <= T + 0.01).pop() ?? snaps[0]
  const off = d[2] ? F.team : tl.opp, def = d[2] ? tl.opp : F.team
  return { off, def, ...k, y0: d[3], plays: snaps.indexOf(k) + 1, t0: d[0], el: Math.max(0, T - d[0]) }
}
const spotOf = (y, off, def) => (y === 50 ? 'MIDFIELD' : y < 50 ? `${off} ${y}` : `${def} ${100 - y}`)

export default function Gameday({ F, act, start, onDone, owner }) {
  const [row, setRow] = useState(start.row ?? null)
  const [news, setNews] = useState(start.news ?? [])
  const [mv, setMv] = useState(() => (start.pend ? momentView(F) : null))
  const tl = useMemo(() => { const t = timelineOf(F, row, mv); if (mv) t.moment = mv; return t }, [row, mv]) // eslint-disable-line react-hooks/exhaustive-deps
  const endT = tl.endT
  const [phase, setPhase] = useState('live')   // live · bump · call · play · result · final
  const [T, setT] = useState(0)
  const Tref = useRef(0)
  const hold = useRef(0)
  const [speed, setSpeed] = useState(readSpeed)
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState('pbp')
  const [pick, setPick] = useState(null)
  const [last, setLast] = useState(null)   // the moment just played: { v, out, word }
  const po = row ? row.rd != null : !!mv?.po
  const rd = row?.rd ?? F.po?.rd
  const wk = row?.wk ?? F.wk + 1
  const momentsOnNow = (F.games ?? 'advanced') !== 'off'

  // the clock runs from where it is to the end (or to the moment), at the speed picked; a score holds it a beat
  useEffect(() => {
    if (phase !== 'live' || paused) return undefined
    if (reduced() && !mv) { Tref.current = endT; setT(endT); arrive(); return undefined }
    let lastNow = performance.now(), lastSet = 0, raf
    const rate = 3600 / (GAME_MS * speed)
    const step = now => {
      const dt = Math.min(100, now - lastNow); lastNow = now
      if (now >= hold.current) Tref.current = Math.min(endT, Tref.current + dt * rate)
      if (Tref.current >= endT) { setT(endT); arrive(); return }
      if (now - lastSet > 90) { lastSet = now; setT(Tref.current) }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, paused, speed, endT]) // eslint-disable-line react-hooks/exhaustive-deps
  const arrive = () => {
    if (mv && !row) {
      // (the moments switched off: the sim plays the snap and the game goes on)
      if ((F.games ?? 'advanced') === 'off') { commit(null, true); return }
      setPhase('bump'); sfx('whistle'); haptic('medium'); return
    }
    setPhase('final')
  }
  const skip = () => { if (phase !== 'live') return; Tref.current = endT; setT(endT); hold.current = 0; arrive() }

  // the score at the clock, and the play that just came up
  const shown = tl.kp.filter(p => p[0] <= T)
  const us = shown.filter(p => p[1]).reduce((a, p) => a + p[2], 0)
  const them = shown.filter(p => !p[1]).reduce((a, p) => a + p[2], 0)
  const lastN = useRef(0)
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (shown.length > lastN.current) {
      const p = shown[shown.length - 1]
      if (p[2] > 0 && phase === 'live') {
        sfx(p[1] ? 'pop' : 'tap')
        const s = p[1] ? F.team : tl.opp
        setFlash({ s, text: `${p[2] >= 6 ? 'TOUCHDOWN' : p[2] === 2 ? 'SAFETY' : 'FIELD GOAL'} ${nick(s)}`, key: `${p[0]}-${shown.length}` })
        hold.current = performance.now() + 900 * Math.min(1.6, speed)
      }
    }
    lastN.current = shown.length
  }, [shown.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(null), 1500); return () => clearTimeout(t) }, [flash])

  // ── a moment: the play is in, the game goes on to its next one or to the final ──
  const commit = (out, quiet = false) => {
    const v = mv
    const named = out ? nameSnap(F, v, out) : null
    const res = act(X => finishMoment(X, named))
    let kp
    if (res?.pending) { const next = momentView(F); setMv(next); kp = next.feed }
    else { const r = res?.row ?? F.log[F.log.length - 1]; setRow(r); setNews(res?.news ?? []); setMv(null); kp = r.kp ?? [] }
    Tref.current = v.t; setT(v.t)
    // (the snap's own score is on the stamp: the flash waits for the next one)
    lastN.current = kp.filter(p => p[0] <= v.t + 15).length
    if (quiet || !named) { setPhase('live'); return }
    const word = snapWord(v, named)
    const good = (word === 'TOUCHDOWN' || word === 'FIRST DOWN') === (v.ball === 'us') || (v.ball !== 'us' && named.to)
    setLast({ v, out: named, word, good })
    setPhase('result')
    sfx(good ? 'claim' : 'deny'); haptic(good ? 'success' : 'heavy')
  }
  const callPlay = id => {
    sfx('tap')
    if ((F.games ?? 'advanced') === 'simple') {
      const P = PLAYS[id]
      commit({ ...simSnap(F.pend.S, P.kind === 'stop' ? 'run' : P.kind, `simple-${id}`), call: P.kind === 'stop' ? 'run' : P.kind, play: id })
      return
    }
    setPick(id); setPhase('play')
  }
  const played = done => { const out = playResult(F, mv, pick, done); setPick(null); commit(out) }
  const simIt = id => { const P = PLAYS[id]; commit({ ...simSnap(F.pend.S, P.kind === 'stop' ? 'run' : P.kind, 'skip'), call: P.kind === 'stop' ? 'run' : P.kind, play: id }) }
  useEffect(() => { if (phase !== 'result') return undefined; const t = setTimeout(() => setPhase('live'), 2400); return () => clearTimeout(t) }, [phase])
  const finalRow = row && phase === 'final' ? row : null
  useEffect(() => { if (finalRow) { setTab(t => (t === 'pbp' ? 'scoring' : t)); if (finalRow.w) { if (finalRow.rd === 3) victory({ big: true }); else sfx('claim') } else sfx('lock') } }, [finalRow])

  // the moments switch: off sims the rest of this game's moments; on comes back with the mode it had
  const setMoments = on => act(X => { if (on) X.games = X.gamesWas ?? 'advanced'; else { if (X.games !== 'off') X.gamesWas = X.games ?? 'advanced'; X.games = 'off' } })

  // the bug, away team first (the broadcast's order)
  const a = tl.home ? tl.opp : F.team, h = tl.home ? F.team : tl.opp
  const fin = phase === 'final'
  const as = fin ? (tl.home ? row.them : row.us) : tl.home ? them : us
  const hs = fin ? (tl.home ? row.us : row.them) : tl.home ? us : them
  const tt = Math.min(T, endT)
  const sit = !fin ? situationAt(tt, tl, F) : null
  const atMoment = (phase === 'bump' || phase === 'call') && mv
  const ballSide = atMoment ? (mv.ball === 'us' ? F.team : mv.opp) : sit?.off
  const poss = ballSide ? (ballSide === h ? 'h' : 'a') : null
  const label = po ? (rd === 3 ? 'SB' : ['WC', 'DIV', 'CONF'][rd]) : `WK ${wk}`
  const kindTxt = po ? (rd === 3 ? `SUPER BOWL ${romanOf(F.year - 1965)}` : rd === 2 ? `${CONF_OF[F.team]} CHAMPIONSHIP` : `${ROUNDS[rd]} ROUND`) : `WEEK ${wk}${DIV_OF[tl.opp] === DIV_OF[F.team] ? ' · DIVISION GAME' : ''}`
  // (the clock on the bug: a quarter's last tick is its 0:00, overtime's periods the right length: plays.js whenOf)
  const [nowQ, nowClock] = whenOf(tt, po).split(' ')
  const status = fin ? (row?.ot ? 'FINAL/OT' : 'FINAL') : `${nowQ} ${nowClock}`
  const dd = atMoment ? `${DOWN[mv.down]} & ${mv.goal ? 'GOAL' : mv.d}` : sit && !fin ? `${DOWN[sit.down]} & ${sit.goal ? 'GOAL' : sit.togo}` : null
  return createPortal(
    <div className={`fk fk-root fg gd${phase === 'play' ? ' is-play' : ''}${fin ? ' is-final' : ''}`} style={fkVars(F.team)}>
      {phase === 'bump' && mv && <Bumper team={mv.ball === 'us' ? F.team : mv.opp} kicker={`${SNAP_KIND[mv.kind]} · ${mv.period === 'OT' ? 'OT' : `Q${mv.period[0]}`} ${mv.clock}`} title="KEY MOMENT" onDone={() => setPhase('call')} />}
      {phase === 'play' && mv && pick && <MomentStage F={F} mv={mv} pick={pick} onDone={played} />}
      {phase !== 'play' && (
        <>
          <header className="gd-head">
            {/* (the week's bar: on top, where the broadcast puts it) */}
            <div className="gd-weekrow">
              <div className="gd-week" style={fkVars(F.team)}><b>{kindTxt}</b><span>{fin ? 'FINAL' : <><i className="gd-live" />LIVE</>}</span></div>
              <MomentsToggle className="gd-mom" label="KEY MOMENTS" on={momentsOnNow} onChange={setMoments} />
            </div>
            <div className="gd-barrow">
            <Scorebug a={a} h={h} as={as} hs={hs} label={label}
              per={nowQ.startsWith('Q') ? ['1ST', '2ND', '3RD', '4TH'][+nowQ[1] - 1] : nowQ} clock={nowClock}
              final={fin ? (row?.ot ? 'F/OT' : 'FINAL') : null} poss={fin ? null : poss} dd={fin ? null : dd} />
            <div className="gd-ctl">
              {fin || phase === 'call' || phase === 'bump' ? null : <SpeedSeg className="gd-speed" steps={SPEEDS} speed={speed} paused={paused} onSpeed={v => { setSpeed(v); keepSpeed(v); setPaused(false) }} onPause={() => setPaused(p => !p)} onSkip={skip} skipLabel={mv && !row ? ['Skip to', 'moment'] : ['Skip to', 'end']} />}
            </div>
            </div>
          </header>
          <div className="gd-main">
            <div className="gd-left">
              {phase === 'live' && flash && <div key={flash.key} className="gd-flash" style={fkVars(flash.s)} role="status"><KLogo s={flash.s} size={26} /><b>{flash.text}</b></div>}
              {phase === 'live' && <Field F={F} sit={sit} tl={tl} T={tt} />}
              {phase === 'call' && mv && <MomentCall F={F} mv={mv} owner={owner} onCall={callPlay} onSim={simIt} />}
              {phase === 'result' && last && <MomentResult last={last} onGo={() => setPhase('live')} />}
              {fin && row && <Final F={F} row={row} news={news} owner={owner} onDone={onDone} />}
              {/* (a wide screen: the scoring under the field, always in view) */}
              {!fin && <div className="gd-side-scoring"><Scoring F={F} tl={tl} row={null} T={tt} /></div>}
            </div>
            <div className="gd-right">
              <div className="gd-tabs" role="tablist" aria-label="Game">
                {[['pbp', 'Play-by-play'], ['scoring', 'Scoring'], ['box', 'Box score']].map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); sfx('tap') }}>{l}</button>)}
              </div>
              {tab === 'pbp' && <PlayByPlay F={F} tl={tl} T={fin ? Infinity : tt} />}
              {tab === 'scoring' && <Scoring F={F} tl={tl} row={fin ? row : null} T={fin ? Infinity : tt} />}
              {tab === 'box' && <Box F={F} row={row} tl={tl} T={tt} fin={fin} status={status} owner={owner} />}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

// ── The field: who has it, the down and distance, the spot, and the drive so far ─────────────────────────────────
function Field({ F, sit, tl, T }) {
  if (!sit) {
    const kick = T < 1 ? 'KICKOFF' : T >= 1800 && T < 1830 ? 'SECOND HALF' : tl.dr ? 'CHANGE OF POSSESSION' : 'IN PROGRESS'
    return <section className="gd-field is-idle"><span className="gd-idle">{kick}</span></section>
  }
  const { off, def, y, togo, goal, y0 } = sit
  const pct = v => `${Math.max(0, Math.min(100, v))}%`
  return (
    <section className="gd-field" aria-label={`${TEAM[off].nick} ball, ${DOWN[sit.down]} and ${goal ? 'goal' : togo} at ${spotOf(y, off, def)}`}>
      <div className="gd-poss" style={fkVars(off)}>
        <KLogo s={off} size={34} />
        <span><small>{TEAM[off].nick} ball</small><b>{DOWN[sit.down]} &amp; {goal ? 'GOAL' : togo}</b></span>
        <span className="gd-spot"><small>Ball on</small><b>{spotOf(y, off, def)}</b></span>
      </div>
      {/* (the offense going left to right: its own end zone on the left) */}
      <div className="gd-strip" style={fkVars(off)}>
        <span className="gd-ez is-own" style={fkVars(off)}>{TEAM[off].short}</span>
        <div className="gd-grass">
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(n => <i key={n} className="gd-yl" style={{ left: `${n}%` }}><em>{n > 50 ? 100 - n : n}</em></i>)}
          <span className="gd-drv" style={{ left: pct(Math.min(y0, y)), width: pct(Math.abs(y - y0)) }} />
          <span className="gd-los" style={{ left: pct(y) }} />
          {!goal && y + togo < 100 && <span className="gd-ltg" style={{ left: pct(y + togo) }} />}
          <span className="gd-ball" style={{ left: pct(y) }} />
        </div>
        <span className="gd-ez" style={fkVars(def)}>{TEAM[def].short}</span>
      </div>
      <div className="gd-drive"><span><b>{sit.plays}</b> {sit.plays === 1 ? 'play' : 'plays'}</span><span><b>{y - y0}</b> yds</span><span><b>{mmss(sit.el)}</b> drive</span></div>
    </section>
  )
}

// ── Play-by-play: the drives as they end, newest first, the scores named, the moments' snaps ─────────────────────
const RES_WORD = { T: 'Touchdown', F: 'Field goal', M: 'Missed field goal', P: 'Punt', X: 'Turnover', D: 'Turnover on downs', E: 'End of half', K: 'Kneel', S: 'Safety' }
function PlayByPlay({ F, tl, T }) {
  const list = []
  for (const d of tl.dr ?? []) {
    if (d[1] > T) continue
    const [t0, t1, mine, y0, res, at] = d
    const s = mine ? F.team : tl.opp
    const score = (res === 'T' || res === 'F') ? tl.kp.find(p => p[0] === t1 && !!p[1] === !!mine && p[2] > 0) : null
    const yds = (res === 'T' ? 100 : at) - y0
    const plays = Math.max(1, Math.round((t1 - t0) / 27))
    const end = res === 'E' && t1 >= 3600 ? 'End of regulation' : null
    list.push({ t: t1, key: `d${t0}`, s, word: end ?? RES_WORD[res] ?? 'Drive', txt: score?.[3] ?? null, sub: res === 'K' ? null : `${plays} ${plays === 1 ? 'play' : 'plays'} · ${yds} yds · ${mmss(t1 - t0)}`, kind: res })
  }
  for (const p of tl.kp) if (p[2] === 0 && p[0] <= T) list.push({ t: p[0] + 0.5, key: `k${p[0]}`, s: p[1] ? F.team : tl.opp, word: 'Key moment', txt: p[3], kind: 'key' })
  // (an old game, played before the drives were kept: the scoring plays)
  if (!tl.dr) for (const p of tl.kp) if (p[2] > 0 && p[0] <= T) list.push({ t: p[0], key: `s${p[0]}`, s: p[1] ? F.team : tl.opp, word: p[2] >= 6 ? 'Touchdown' : 'Field goal', txt: p[3], kind: p[2] >= 6 ? 'T' : 'F' })
  list.sort((x, y) => y.t - x.t)
  if (!list.length) return <div className="gd-list"><div className="gd-empty">{T < 1 ? 'Kickoff' : 'First drive under way'}</div></div>
  return (
    <ol className="gd-list" aria-live="polite">
      {list.map(e => {
        const [q, clock] = whenOf(e.t, tl.po).split(' ')
        return (
          <li key={e.key} className={`gd-pbp is-${e.kind}`} style={fkVars(e.s)}>
            <span className="gd-when"><b>{q}</b>{clock}</span>
            <span className="gd-pbp-txt"><b><KLogo s={e.s} size={16} />{e.word}</b>{e.txt && <span>{e.txt}</span>}{e.sub && <small>{e.sub}</small>}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Scoring: every score, by quarter, with the line score on top ─────────────────────────────────────────────────
function Scoring({ F, tl, row, T }) {
  const a = tl.home ? tl.opp : F.team, h = tl.home ? F.team : tl.opp
  const kp = tl.kp.filter(p => p[2] > 0 && p[0] <= T)
  // the score by quarter: the final's own, or the scores so far
  const qOf = t => (t >= 3600 ? 4 : Math.min(3, Math.floor(t / 900)))
  const n = Math.max(4, ...kp.map(p => qOf(p[0]) + 1), row?.ot ? 5 : 4)
  const line = side => { const q = Array(n).fill(0); for (const p of kp) if (!!p[1] === (side === F.team)) q[qOf(p[0])] += p[2]; return q }
  return (
    <div className="gd-list gd-scoring">
      <div className="fg-quarters" style={{ '--n': n }}>
        <span className="is-head" />{Array.from({ length: n }, (_, i) => <span key={i} className="is-head">{i === 4 ? 'OT' : i + 1}</span>)}<span className="is-head">T</span>
        {[a, h].map(s => { const q = line(s); return [<span key={`${s}n`} className="is-team"><KLogo s={s} size={18} />{s}</span>, ...q.map((v, i) => <span key={`${s}${i}`}>{v}</span>), <span key={`${s}t`} className="is-tot">{q.reduce((x, y) => x + y, 0)}</span>] })}
      </div>
      {kp.length ? kp.map(p => {
        const s = p[1] ? F.team : tl.opp
        const [q, clock] = whenOf(p[0], tl.po).split(' ')
        return (
          <div key={`${p[0]}-${p[3]}`} className="fg-play" style={fkVars(s)}>
            <span className="fg-play-when"><b>{q}</b>{clock}</span>
            <span className="fg-play-txt">{p[3]}</span>
            <span className="fg-play-pts">{p[2] >= 6 ? 'TD' : p[2] === 3 ? 'FG' : 'SAF'}</span>
          </div>
        )
      }) : <div className="gd-empty">No score yet</div>}
    </div>
  )
}

// ── The box score (SquadSeason.jsx BoxSheet, in Franchise's colours): both teams' lines, the men's, the kicking ───
// (live: the final's lines as far as the game has gone; a game waiting on a moment: the drives so far)
const scaleLine = (x, f) => Object.fromEntries(Object.entries(x ?? {}).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * f) : v]))
function Box({ F, row, tl, T, fin, status, owner }) {
  const B = useMemo(() => (row ? gameBox(F, row) : null), [row]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = tl.opp
  if (row && !B) return <div className="gd-list gd-box"><p className="gd-note">No box score was kept for games played before this update.</p></div>
  if (!row || !B) {
    // the drives so far: the time with the ball, the scores, the turnovers, the punts
    const dr = (tl.dr ?? []).filter(d => d[1] <= T)
    const of = m => { const x = dr.filter(d => !!d[2] === m); return { top: x.reduce((s, d) => s + d[1] - d[0], 0), td: x.filter(d => d[4] === 'T').length, fg: x.filter(d => d[4] === 'F').length, to: x.filter(d => d[4] === 'X' || d[4] === 'D').length, p: x.filter(d => d[4] === 'P').length, n: x.length, yds: x.reduce((s, d) => s + Math.max(0, (d[4] === 'T' ? 100 : d[5]) - d[3]), 0) } }
    const u = of(true), o = of(false)
    return (
      <div className="gd-list gd-box">
        <div className="sq-tstat">
          <div className="sq-tstat-row sq-tstat-head"><span /><span><KLogo s={F.team} size={18} />{F.team}</span><span><KLogo s={a} size={18} />{a}</span></div>
          {[['DRIVES', u.n, o.n], ['YARDS ON DRIVES', u.yds, o.yds], ['TOUCHDOWNS', u.td, o.td], ['FIELD GOALS', u.fg, o.fg], ['TURNOVERS', u.to, o.to], ['PUNTS', u.p, o.p], ['POSSESSION', mmss(u.top), mmss(o.top)]].map(([k, x, y]) => <div key={k} className="sq-tstat-row"><span>{k}</span><b>{x}</b><b>{y}</b></div>)}
        </div>
        <p className="gd-note">The players’ lines come in with the final.</p>
      </div>
    )
  }
  const f = fin ? 1 : Math.max(0, Math.min(1, T / Math.max(1, tl.endT)))
  const shown = tl.kp.filter(p => p[0] <= T)
  return (
    <div className="gd-list gd-box">
      <GameBoxSheet F={F} row={row} B={B} owner={owner} f={f} status={fin ? null : status} my={fin ? null : shown.filter(p => p[1]).reduce((s, p) => s + p[2], 0)} op={fin ? null : shown.filter(p => !p[1]).reduce((s, p) => s + p[2], 0)} />
      {!fin && <p className="gd-note">Live: the lines so far.</p>}
    </div>
  )
}

// The game's box score sheet: on the game screen (in place, f: how far the game has gone), and from the hub's last
// result (portal, onClose: over the page)
export function GameBoxSheet({ F, row, B: B0 = null, owner, f = 1, status = null, my = null, op = null, portal = false, onClose = null }) {
  const B = useMemo(() => B0 ?? gameBox(F, row), [row, B0]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!B) return null
  const S = x => (f === 1 ? x : scaleLine(x, f))
  const game = { s: Object.fromEntries(Object.entries(B.game.s).map(([k, x]) => [k, S(x)])), us: S(B.game.us), them: S(B.game.them) }
  const opp = { s: Object.fromEntries(Object.entries(B.opp.game.s).map(([k, x]) => [k, S(x)])) }
  const g = { i: 0, po: false, opp: row.opp, home: row.home, my: my ?? row.us, op: op ?? row.them, won: row.us > row.them, tie: !!row.t, ot: row.ot, label: row.rd != null ? ROUNDS[row.rd] ?? 'PLAYOFFS' : `WEEK ${row.wk}` }
  const u = game.us, o = game.them
  const fd = [Math.round(B.fd[0] * f), Math.round(B.fd[1] * f)], top = [B.top[0] * f, B.top[1] * f]
  const rows = [
    ['FIRST DOWNS', fd[0], fd[1]], ['TOTAL YARDS', u.yds, o.yds], ['PASSING', u.py, o.py], ['RUSHING', u.ry, o.ry],
    ['COMP / ATT', `${u.pc ?? 0}/${u.pa ?? 0}`, `${o.pc ?? 0}/${o.pa ?? 0}`], ['SACKED', u.sk, o.sk], ['TURNOVERS', u.to, o.to], ['POSSESSION', mmss(top[0]), mmss(top[1])],
  ]
  const kick = f === 1 ? B.kick.filter(Boolean) : []
  // (the builds' faces, as everywhere else in Franchise)
  const faces = Object.fromEntries((F.builds ?? []).map((_, i) => { const p = F.teams[F.team].r.find(x => x.b === i); let src = null; try { src = p ? faceFor(F, p, F.team, true) : null } catch { src = null } return [String(i), src] }))
  return (
    <BoxSheet r={B.r} sport="nfl" g={g} box={{ reg: [game], po: [] }} owner={owner} faces={faces} portal={portal} all label={TEAM[F.team].name.toUpperCase()} onClose={onClose} rows={rows} status={status ?? (row.ot ? 'FINAL · OT' : 'FINAL')} className={portal ? 'fk fk-root gd-sheet-modal' : 'gd-sheet'}>
      {kick.length > 0 && <div className="sq-box-sec"><span className="sq-box-h">KICKING</span><FbTable head={['KICKING', 'FG', 'XP', 'LONG', '50+']} rows={kick.map((k, i) => ({ k: `k${i}`, name: k.n.split(' ').slice(-1)[0], role: i ? row.opp : F.team, cells: [`${k.line[1]}/${k.line[0]}`, `${k.line[3]}/${k.line[2]}`, k.line[4] || '—', `${k.line[6] ?? 0}/${k.line[5] ?? 0}`] }))} /></div>}
      {Object.keys(opp.s).length > 0 && <FootballBox r={B.opp.r} game={opp} owner={owner} label={TEAM[row.opp].name.toUpperCase()} all />}
    </BoxSheet>
  )
}

// ── The moment: the snap, the score, the clock, and the calls (or the backer on defense) ─────────────────────────
function MomentCall({ F, mv, owner, onCall, onSim }) {
  const off = mv.ball === 'us'
  const ballTeam = off ? F.team : mv.opp
  // (the score from the side of the team with the ball, the way the broadcast says it: "Rams ball · Lions up 7")
  const m = mv.mine - mv.theirs
  const where = m === 0 ? `tied ${mv.mine}-${mv.theirs}` : `${TEAM[m > 0 ? F.team : mv.opp].nick} up ${Math.abs(m)}`
  const calls = playsFor(mv)
  const simple = (F.games ?? 'advanced') === 'simple'
  const qb = ctlFor(F, mv, calls.find(id => PLAYS[id].kind === 'pass') ?? calls[0])
  const rb = calls.some(id => PLAYS[id].kind === 'run') ? ctlFor(F, mv, calls.find(id => PLAYS[id].kind === 'run')) : null
  const lb = !off ? ctlFor(F, mv, 'stop') : null
  return (
    <section className="gd-call" onClick={e => e.stopPropagation()}>
      <Chyron team={ballTeam} tag={`${mv.period === 'OT' ? 'OT' : `Q${mv.period[0]}`} ${mv.clock}`} title={SNAP_KIND[mv.kind]} sub={`${TEAM[ballTeam].nick} ball · ${where}`} />
      <div className="fg-dd"><b>{DOWN[mv.down]} &amp; {mv.goal ? 'GOAL' : mv.d}</b><span>{mv.goal ? 'GOAL TO GO' : `AT THE ${mv.spotTxt}`}<small>{mv.clock} LEFT IN THE {mv.period === 'OT' ? 'OVERTIME' : `${mv.period} QUARTER`}</small></span></div>
      {off ? (
        <>
          <h3 className="gd-h">Call the play</h3>
          <div className="gd-plays">
            {calls.map(id => {
              const P = PLAYS[id]
              return (
                <button key={id} type="button" className={`gd-play is-${P.kind}`} onClick={() => onCall(id)}>
                  <small>{P.kind === 'pass' ? 'PASS' : 'RUN'}</small><b>{P.name}</b><span>{P.tag}</span>
                </button>
              )
            })}
          </div>
          <div className="gd-men">
            {qb && <ManL3 F={F} p={qb} team={F.team} owner={owner} size="s" line="On a pass" />}
            {rb && <ManL3 F={F} p={rb} team={F.team} owner={owner} size="s" line="On a run" />}
          </div>
          <button type="button" className="gd-sim" onClick={() => onSim(calls[0])}>Let the sim play this snap</button>
        </>
      ) : (
        <>
          <h3 className="gd-h">Make the stop</h3>
          {lb && <ManL3 F={F} p={lb} team={F.team} owner={owner} size="m" line="Read the back, fill the hole" />}
          <Go onClick={() => onCall('stop')}>{simple ? 'Play it' : 'Take the field'}</Go>
          <button type="button" className="gd-sim" onClick={() => onSim('stop')}>Let the sim play this snap</button>
        </>
      )}
    </section>
  )
}
function MomentResult({ last, onGo }) {
  return (
    <section className="gd-result" onClick={onGo}>
      <Stamp kind={last.good ? 'w' : 'l'} big>{last.word}</Stamp>
      {last.out?.txt && <p>{last.out.txt}</p>}
      <small className="fg-tap">Tap to go on</small>
    </section>
  )
}
// the snap on the mini games' stage (the engine, the men from both depth charts, the down and distance the game set)
function MomentStage({ F, mv, pick, onDone }) {
  useEffect(() => minigameOpen(), [])
  const S = useMemo(() => playSetup(F, mv, pick), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Suspense fallback={<div className="gd-wait" />}>
      <MgStage game={S.game} def={S.def} v={S.v} arm={S.arm} seed={S.seed} sport="nfl" team={S.team} opp={S.opp} home={S.home} pos={S.pos} cast={S.cast} situation={S.situation}
        superBowl={mv.po && F.po?.rd === 3 ? romanOf(F.year - 1965) : null} onDone={onDone} />
    </Suspense>
  )
}

// ── FINAL ────────────────────────────────────────────────────────────────────
function Final({ F, row, news, owner, onDone }) {
  const res = row.w ? 'w' : row.t ? 't' : 'l'
  const a = row.home ? row.opp : F.team, h = row.home ? F.team : row.opp
  const qa = row.home ? row.q?.[1] : row.q?.[0], qh = row.home ? row.q?.[0] : row.q?.[1]
  const sa = row.home ? row.them : row.us, sh = row.home ? row.us : row.them
  const mine = (row.lines ?? []).map(l => ({ ...l, p: F.teams[F.team].r.find(x => x.i === l.pid) })).filter(l => l.p && l.line)
  const star = row.st && !mine.some(l => l.pid === row.st.pid) ? F.teams[F.team].r.find(x => x.i === row.st.pid) : null
  const tag = row.rd != null ? (row.rd === 3 ? `SUPER BOWL ${romanOf(F.year - 1965)}` : row.rd === 2 ? `${CONF_OF[F.team]} CHAMPIONSHIP` : `${ROUNDS[row.rd]} ROUND`) : `WEEK ${row.wk}`
  const n = Math.max(4, qa?.length ?? 4)
  const T = (s, q, pts, lose) => (
    <div className={`gd-fin-t${lose ? ' is-lose' : ''}`} style={fkVars(s)}>
      <KLogo s={s} size={30} /><b>{TEAM[s].nick}</b>
      {Array.from({ length: n }, (_, i) => <span key={i}>{q?.[i] ?? 0}</span>)}
      <strong>{pts}</strong>
    </div>
  )
  return (
    <section className="gd-final" onClick={e => e.stopPropagation()}>
      <div className="gd-fin">
        <div className="gd-fin-h" style={{ '--n': n }}><span>{tag}{row.ot ? ' · OT' : ''}</span>{Array.from({ length: n }, (_, i) => <span key={i}>{i === 4 ? 'OT' : i + 1}</span>)}<span>T</span></div>
        <div style={{ '--n': n }}>{T(a, qa, sa, !row.t && sa < sh)}</div>
        <div style={{ '--n': n }}>{T(h, qh, sh, !row.t && sh < sa)}</div>
      </div>
      <div className="fg-head gd-hl">
        <Stamp kind={res} delay={350}>{res === 'w' ? 'WIN' : res === 't' ? 'TIE' : 'LOSS'}</Stamp>
        <span><h2>{row.hl}</h2>{row.sub && <p>{row.sub}</p>}</span>
      </div>
      {row.ms?.length > 0 && (
        <div className="fg-feed">
          <Chyron tone="ink" size="s" title="Key moments" />
          {row.ms.map((m, i) => <div key={i} className={`gd-mo${m.ok ? ' is-ok' : ''}`}><span className="fg-play-when"><b>{whenOf(m.t, row.rd != null).split(' ')[0]}</b>{whenOf(m.t, row.rd != null).split(' ')[1]}</span><span>{m.txt}</span><i>{m.ok ? (m.side === 'def' ? 'STOP' : 'MADE IT') : (m.side === 'def' ? 'THEIRS' : 'NO')}</i></div>)}
        </div>
      )}
      {(mine.length > 0 || star) && (
        <div className="fg-feed">
          <Chyron team={F.team} size="s" title={mine.length ? `${owner}'s builds` : 'Player of the game'} />
          {mine.map((l, i) => <ManL3 key={l.pid} F={F} p={l.p} team={F.team} owner={owner} size="s" line={l.line} delay={i * 60} />)}
          {star && mine.length > 0 && <Chyron tone="ink" size="s" title="Player of the game" />}
          {star && <ManL3 F={F} p={star} team={F.team} size="s" line={row.st.line} />}
        </div>
      )}
      {news.some(x => x.k === 'inj' || x.k === 'sign') && (
        <div className="fg-tags">
          {news.filter(x => x.k === 'inj').map(x => <Tag key={x.pid} tone="inj">{x.n.toUpperCase()}{x.what ? ` (${String(x.what).toUpperCase()})` : ''} · {x.se ? 'OUT FOR THE SEASON' : x.wk >= 4 ? `INJURED RESERVE · ${x.wk} WEEKS` : `OUT ${x.wk} ${x.wk === 1 ? 'WEEK' : 'WEEKS'}`}</Tag>)}
          {news.filter(x => x.k === 'sign').map(x => <Tag key={x.pid} tone="line">SIGNED {x.n.toUpperCase()} OFF THE PRACTICE SQUAD</Tag>)}
        </div>
      )}
      <ActionBar className="gd-go"><Go onClick={() => { sfx('tap'); onDone() }}>Continue</Go></ActionBar>
    </section>
  )
}
