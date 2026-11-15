import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, momentView, finishMoment, clockText, periodOf, normalRate, POS_LABEL } from '../../lib/franchise2'
import { roll } from '../../lib/franchise2/rng'
import { GAMES } from '../../lib/minigames'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { sfx, haptic, victory } from '../../lib/juice'
import { IconArrow } from '../app/icons'
import { Logo, Face, Stamp, Count, teamVars } from './bits'
import { romanOf } from '../../lib/mg/kit'

const MiniGame = lazy(() => import('../app/MiniGame'))
const MiniGameSimple = lazy(() => import('../app/MiniGameSimple'))
const reduced = () => { try { return document.documentElement.classList.contains('bap-reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// GAME DAY: the player's game, live and quick. A scorebug runs the clock through the game in about three
// seconds (a tap skips it), the scores tick up as they happen, a moment stops it where it falls in the 4th
// (the play is the build's mini game; the game goes on from whatever it did), then the FINAL card.
//   start: { row } a finished game, or { pend: true } a game waiting on its moment (F.pend)
const RUN_MS = 2800
const DOWN = ['', '1ST', '2ND', '3RD', '4TH']

export default function Gameday({ F, act, start, onDone, owner }) {
  const [row, setRow] = useState(start.row ?? null)
  const [news] = useState(start.news ?? [])
  const mv = useMemo(() => (start.pend ? momentView(F) : null), []) // eslint-disable-line react-hooks/exhaustive-deps
  // the plays to show: [t, mine, points]
  const plays = useMemo(() => {
    if (row) return row.pl.filter(p => p[2] > 0).map(([t, mine, p]) => ({ t, mine, p }))
    const us = F.pend.S.key.us
    return F.pend.S.plays.filter(p => p.p > 0).map(p => ({ t: p.t, mine: p.s === us ? 1 : 0, p: p.p }))
  }, [row]) // eslint-disable-line react-hooks/exhaustive-deps
  const opp = row?.opp ?? mv?.opp
  const home = row ? row.home : mv?.home
  const endT = row ? Math.max(3600, ...row.pl.map(p => p[0])) : mv ? F.pend.S.key.t : 3600
  const [phase, setPhase] = useState('live')   // live · moment · play · final
  const [T, setT] = useState(start.from ?? 0)
  const fromRef = useRef(start.from ?? 0)
  const raf = useRef(0)

  // the clock runs from where it is to the end (or to the moment)
  useEffect(() => {
    if (phase !== 'live') return
    const from = fromRef.current, span = Math.max(1, endT - from)
    if (reduced()) { setT(endT); arrive(); return }
    let t0
    const ms = RUN_MS * Math.min(1.15, span / 3600) + 300
    const step = now => {
      t0 ??= now
      const k = Math.min(1, (now - t0) / ms)
      const tt = from + span * k
      setT(tt)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else arrive()
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [phase, endT]) // eslint-disable-line react-hooks/exhaustive-deps
  const arrive = () => {
    if (!row && mv) { setPhase('moment'); sfx('whistle'); haptic('medium'); return }
    setPhase('final')
  }
  const skip = () => { if (phase !== 'live') return; cancelAnimationFrame(raf.current); setT(endT); arrive() }

  // the scores at the clock
  const shown = plays.filter(p => p.t <= T)
  const us = shown.filter(p => p.mine).reduce((a, p) => a + p.p, 0)
  const them = shown.filter(p => !p.mine).reduce((a, p) => a + p.p, 0)
  const lastN = useRef(0)
  useEffect(() => { if (shown.length > lastN.current) { const p = shown[shown.length - 1]; sfx(p.mine ? 'pop' : 'tap') } lastN.current = shown.length }, [shown.length])

  // the moment's play is in: the game goes on from there
  const played = res => {
    const hit = !!res?.hit
    act(X => finishMoment(X, hit))
    const r = F.log[F.log.length - 1]
    fromRef.current = T
    setRow(r); setPhase('result')
    sfx(hit ? 'claim' : 'deny'); haptic(hit ? 'success' : 'heavy')
    setTimeout(() => setPhase('live'), 1300)
  }
  const skipAll = () => {
    act(X => { X.games = 'off' })
    const p = F.teams[F.team].r.find(x => x.i === mv.pid)
    played({ hit: roll(`${F.seed}-${F.year}-${F.wk}-skip`) < normalRate(p?.o ?? 80) })
  }
  const finalRow = row && phase === 'final' ? row : null
  useEffect(() => { if (finalRow) { if (finalRow.w) { if (finalRow.rd === 3) victory({ big: true }); else sfx('claim') } else sfx('lock') } }, [finalRow])

  const me = TEAM[F.team], them_ = TEAM[opp]
  const per = periodOf(Math.min(T, endT - 0.01 < 0 ? 0 : T))
  return createPortal(
    <div className={`f2 f2-gd${phase === 'play' ? ' is-play' : ''}`} style={teamVars(F.team)} onClick={phase === 'live' ? skip : undefined}>
      <div className="f2-bug" role="status">
        <span className="f2-bug-team" style={teamVars(F.team)}><Logo s={F.team} size={30} /><b>{me.short}</b><strong>{us}</strong></span>
        <span className="f2-bug-clock"><b>{phase === 'final' ? (row?.ot ? 'F/OT' : 'FINAL') : per}</b><small>{phase === 'final' ? '' : clockText(Math.min(T, 3599.9))}</small></span>
        <span className="f2-bug-team is-opp" style={teamVars(opp)}><strong>{them}</strong><b>{them_.short}</b><Logo s={opp} size={30} /></span>
      </div>
      <div className="f2-gd-body">
        {phase === 'live' && (
          <div className="f2-gd-live">
            <span className="ag-eyebrow">{row?.rd != null || F.phase === 'playoffs' ? 'PLAYOFFS' : `WEEK ${row?.wk ?? F.wk + 1}`} · {home ? 'HOME' : 'AWAY'}</span>
            <div className="f2-gd-score"><b>{us}</b><i>–</i><b>{them}</b></div>
            <div className="f2-gd-feed">
              {shown.slice(-3).reverse().map((p, i) => <span key={`${p.t}-${i}`} className={`f2-gd-play${p.mine ? ' is-us' : ''}`}><Logo s={p.mine ? F.team : opp} size={18} />{p.p >= 6 ? 'TOUCHDOWN' : p.p === 3 ? 'FIELD GOAL' : 'SAFETY'} · {periodOf(p.t)} {clockText(p.t)}</span>)}
            </div>
            <small className="f2-gd-tap">TAP TO SKIP</small>
          </div>
        )}
        {phase === 'moment' && mv && <MomentCard F={F} mv={mv} owner={owner} onPlay={() => { setPhase('play'); sfx('tap') }} />}
        {phase === 'play' && mv && <MomentPlay F={F} mv={mv} onDone={played} onSkipAll={skipAll} />}
        {phase === 'result' && row?.mo && <MomentResult row={row} def={mv?.ball === 'them'} />}
        {phase === 'final' && row && <Final F={F} row={row} news={news} owner={owner} onDone={onDone} />}
      </div>
    </div>,
    document.body,
  )
}

// ── The moment: the down, the distance, the spot, the clock, and the man ────
function MomentCard({ F, mv, owner, onPlay }) {
  const p = F.teams[F.team].r.find(x => x.i === mv.pid)
  const behind = mv.mine < mv.theirs, level = mv.mine === mv.theirs
  const where = `${level ? 'TIED' : behind ? 'DOWN' : 'UP'} ${level ? `${mv.mine}-${mv.theirs}` : `${Math.abs(mv.mine - mv.theirs)}`}`
  const def = mv.ball === 'them'
  return (
    <section className="f2-moment ag-pop">
      <span className="ag-eyebrow">KEY MOMENT · {mv.clock} {mv.period}</span>
      <h2 className="f2-moment-dd">{DOWN[mv.down]} &amp; {mv.goal ? 'GOAL' : mv.d}</h2>
      <b className="f2-moment-spot">{mv.goal ? 'GOAL TO GO' : `AT ${mv.spotTxt}`} · {where}</b>
      <div className="f2-moment-who">
        {p && <Face F={F} p={p} size={64} />}
        <span><b>{p?.n?.toUpperCase()}</b><small>{POS_LABEL[p?.p]} · {owner.toUpperCase()}</small></span>
      </div>
      <b className="f2-moment-need">{def ? 'GET A STOP' : mv.goal ? 'PUNCH IT IN' : 'MOVE THE CHAINS'}</b>
      <button className="ag-btn ag-btn--gold f2-go" onClick={e => { e.stopPropagation(); onPlay() }}>PLAY IT <IconArrow size={16} /></button>
    </section>
  )
}
function MomentPlay({ F, mv, onDone, onSkipAll }) {
  const B = F.builds[mv.b]
  const p = F.teams[F.team].r.find(x => x.i === mv.pid)
  const us = TEAM[F.team], opp = TEAM[mv.opp]
  const def = mv.ball === 'them'
  const line = `${us.short} ${mv.mine === mv.theirs ? `and ${opp.short} tied at ${mv.mine}` : mv.mine < mv.theirs ? `down ${mv.mine}-${mv.theirs} to ${opp.short}` : `up ${mv.mine}-${mv.theirs} on ${opp.short}`}, ${mv.clock} left in the ${mv.period === '4TH' ? '4th' : mv.period}.`
  const dn = DOWN[mv.down].toLowerCase()
  const tail = def ? `${opp.short} has the ball, ${dn} and ${mv.goal ? 'goal' : mv.d}. ${us.short} needs a stop.` : `${dn[0].toUpperCase()}${dn.slice(1)} and ${mv.goal ? 'goal' : mv.d}${mv.goal ? '' : ` at the ${mv.spotTxt}`}.`
  const sit = { us: us.short, them: opp.short, mine: mv.mine, opp: mv.theirs, hoops: false, clock: 60, clockText: mv.clock, period: mv.period, line, tail, dist: mv.d, ...(def && { stop: true }) }
  const simple = (F.games ?? 'advanced') === 'simple' && SIMPLE_GAMES[mv.game]
  return (
    <div className="f2-mg" onClick={e => e.stopPropagation()}>
      <Suspense fallback={<div className="f2-mg-wait" />}>
        {simple
          ? <MiniGameSimple game={mv.game} build={B.build} pos={p?.p ?? B.pos} seed={mv.seed} onDone={onDone} onSkipAll={onSkipAll} />
          : <MiniGame game={mv.game} build={B.build} pos={p?.p ?? B.pos} seed={mv.seed} team={us} opp={opp} situation={sit} home={mv.home ? 'team' : 'opp'} superBowl={mv.po && F.po?.rd === 3 ? romanOf(F.year - 1965) : null} onDone={onDone} onSkipAll={onSkipAll} />}
      </Suspense>
      {!GAMES[mv.game] && !SIMPLE_GAMES[mv.game] && <button className="ag-btn ag-btn--gold" onClick={() => onDone({ hit: roll(mv.seed) < 0.55 })}>CONTINUE</button>}
    </div>
  )
}
const KEY_LINE = { td: 'TOUCHDOWN', 'conv-td': 'FIRST DOWN', 'conv-fg': 'FIRST DOWN', 'conv-stall': 'FIRST DOWN', pick: 'PICKED OFF', punt: 'STOPPED', downs: 'STOPPED ON DOWNS', 'held-fg': 'HELD TO THREE', 'held-miss': 'STOPPED' }
function MomentResult({ row, def }) {
  const { hit, line } = row.mo
  const text = hit ? KEY_LINE[line] ?? 'MADE IT' : def ? (line === 'td' || line === 'conv-td' ? 'TOUCHDOWN' : 'THEY CONVERTED') : line === 'pick' ? 'PICKED OFF' : 'STOPPED SHORT'
  return (
    <section className="f2-mresult ag-pop">
      <Stamp kind={hit ? 'w' : 'l'} big>{text}</Stamp>
    </section>
  )
}

// ── FINAL ────────────────────────────────────────────────────────────────────
function Final({ F, row, news, owner, onDone }) {
  const res = row.w ? 'w' : row.t ? 't' : 'l'
  const lines = row.lines.filter(l => l.line)
  return (
    <section className={`f2-final ag-pop is-${res}`} onClick={e => e.stopPropagation()}>
      <div className="f2-final-top">
        <Stamp kind={res} big delay={150}>{res === 'w' ? 'W' : res === 't' ? 'T' : 'L'}</Stamp>
        <div className="f2-final-score">
          <span style={teamVars(F.team)}><Logo s={F.team} size={44} /><b><Count v={row.us} ms={600} /></b></span>
          <i>–</i>
          <span style={teamVars(row.opp)}><b><Count v={row.them} ms={600} /></b><Logo s={row.opp} size={44} /></span>
        </div>
      </div>
      <h2 className="f2-final-hl">{row.hl}</h2>
      {row.mo && <span className={`f2-tag ${row.mo.hit ? 'is-gold' : 'is-inj'}`}>KEY MOMENT · {row.mo.hit ? 'MADE THE PLAY' : 'CAME UP SHORT'}</span>}
      {lines.length > 0 && (
        <div className="f2-final-lines">
          {lines.map(l => { const p = F.teams[F.team].r.find(x => x.i === l.pid); return p ? <span key={l.pid} className="f2-final-line"><Face F={F} p={p} size={34} /><b>{p.n}</b><small>{l.line}</small></span> : null })}
        </div>
      )}
      {news.filter(n => n.k === 'inj').map(n => <span key={n.pid} className="f2-tag is-inj">{n.n.toUpperCase()} · OUT {n.wk} {n.wk === 1 ? 'WEEK' : 'WEEKS'}</span>)}
      <button className="ag-btn ag-btn--gold f2-go" onClick={() => { sfx('tap'); onDone() }}>CONTINUE <IconArrow size={16} /></button>
    </section>
  )
}
