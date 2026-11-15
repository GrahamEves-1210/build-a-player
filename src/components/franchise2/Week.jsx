import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, momentView, finishMoment, clockText, periodOf, normalRate, ROUNDS, CONF_OF } from '../../lib/franchise2'
import { startersOf } from '../../lib/franchise2/roster'
import { momentCast } from '../../lib/franchise2/cast'
import { whenOf } from '../../lib/franchise2/plays'
import { roll } from '../../lib/franchise2/rng'
import { GAMES } from '../../lib/minigames'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { sfx, haptic, victory } from '../../lib/juice'
import { romanOf } from '../../lib/mg/kit'
import { fkVars, Chyron, Scorebug, ManL3, BigNum, Stamp, Go, Tag, Bumper, reduced, ActionBar } from './kit'

const MiniGame = lazy(() => import('../app/MiniGame'))
const MiniGameSimple = lazy(() => import('../app/MiniGameSimple'))

// GAME DAY: the player's game, live and quick. The scorebug runs the clock through the game in about three seconds
// (a tap skips it); the scoring plays come up as they happen, with the men who made them ("Bo Nix 18-yd pass to
// Courtland Sutton"). A moment stops it where it falls in the 4th: a broadcast bumper, the down and distance, the build
// and the man across from him, then the play (the build's mini game, with both teams' real men from their depth
// charts). The game goes on from whatever the play did, and ends on the FINAL graphic.
//   start: { row } a finished game, or { pend: true } a game waiting on its moment (F.pend)
const RUN_MS = 2800
const DOWN = ['', '1ST', '2ND', '3RD', '4TH']
const nick = s => TEAM[s].nick.toUpperCase()

export default function Gameday({ F, act, start, onDone, owner }) {
  const [row, setRow] = useState(start.row ?? null)
  const [news] = useState(start.news ?? [])
  const mv = useMemo(() => (start.pend ? momentView(F) : null), []) // eslint-disable-line react-hooks/exhaustive-deps
  // the plays: [t, mine, pts, text] (the finished game's summary, or the plays named before the moment)
  const plays = row?.kp ?? mv?.feed ?? []
  const opp = row?.opp ?? mv?.opp
  const home = row ? row.home : mv?.home
  const endT = row ? Math.max(3600, ...(row.pl ?? []).map(p => p[0])) : mv ? mv.t : 3600
  const [phase, setPhase] = useState('live')   // live · bump · moment · play · result · final
  const [T, setT] = useState(0)
  const fromRef = useRef(0)
  const raf = useRef(0)
  const po = row ? row.rd != null : !!mv?.po
  const rd = row?.rd ?? F.po?.rd
  const label = po ? (rd === 3 ? 'SB' : ['WC', 'DIV', 'CONF'][rd]) : `WK ${row?.wk ?? F.wk + 1}`

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
      setT(from + span * k)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else arrive()
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [phase, endT]) // eslint-disable-line react-hooks/exhaustive-deps
  const arrive = () => {
    if (!row && mv) { setPhase('bump'); sfx('whistle'); haptic('medium'); return }
    setPhase('final')
  }
  const skip = () => { if (phase !== 'live') return; cancelAnimationFrame(raf.current); setT(endT); arrive() }

  // the score at the clock, and the play that just came up
  const shown = plays.filter(p => p[0] <= T)
  const us = shown.filter(p => p[1]).reduce((a, p) => a + p[2], 0)
  const them = shown.filter(p => !p[1]).reduce((a, p) => a + p[2], 0)
  const lastN = useRef(0)
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (shown.length > lastN.current) {
      const p = shown[shown.length - 1]
      if (p[2] > 0 && phase === 'live') {
        sfx(p[1] ? 'pop' : 'tap')
        const s = p[1] ? F.team : opp
        setFlash({ s, text: `${p[2] >= 6 ? 'TOUCHDOWN' : 'FIELD GOAL'} ${nick(s)}`, key: `${p[0]}-${shown.length}` })
      }
    }
    lastN.current = shown.length
  }, [shown.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1100); return () => clearTimeout(t) }, [flash])

  // the moment's play is in: the game goes on from there
  const played = res => {
    const hit = !!res?.hit
    act(X => finishMoment(X, hit))
    const r = F.log[F.log.length - 1]
    fromRef.current = T
    lastN.current = r.kp.filter(p => p[0] <= T).length
    setRow(r); setPhase('result')
    sfx(hit ? 'claim' : 'deny'); haptic(hit ? 'success' : 'heavy')
  }
  const resume = () => { if (phase === 'result') setPhase('live') }
  useEffect(() => { if (phase !== 'result') return; const t = setTimeout(resume, 1900); return () => clearTimeout(t) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const skipAll = () => {
    act(X => { X.games = 'off' })
    const p = F.teams[F.team].r.find(x => x.i === mv.pid)
    played({ hit: roll(`${F.seed}-${F.year}-${F.wk}-skip`) < normalRate(p?.o ?? 80) })
  }
  const finalRow = row && phase === 'final' ? row : null
  useEffect(() => { if (finalRow) { if (finalRow.w) { if (finalRow.rd === 3) victory({ big: true }); else sfx('claim') } else sfx('lock') } }, [finalRow])

  // the bug, away team first (the broadcast's order)
  const a = home ? opp : F.team, h = home ? F.team : opp
  const as = home ? them : us, hs = home ? us : them
  const atMoment = phase === 'moment' || phase === 'bump'
  const poss = atMoment && mv ? ((mv.ball === 'us') === home ? 'h' : 'a') : null
  const tt = Math.min(T, endT)
  return createPortal(
    <div className={`fk fk-root fg${phase === 'play' ? ' is-play' : ''}`} style={fkVars(F.team)} onClick={phase === 'live' ? skip : phase === 'result' ? resume : undefined}>
      {phase === 'bump' && mv && <Bumper team={F.team} kicker={`${mv.period} QUARTER · ${mv.clock}`.replace('OT QUARTER', 'OVERTIME')} title="KEY MOMENT" onDone={() => setPhase('moment')} />}
      {phase !== 'play' && (
        <div className="fg-in">
          <div className="fg-bug">
            <Scorebug a={a} h={h} as={phase === 'final' ? (home ? row.them : row.us) : as} hs={phase === 'final' ? (home ? row.us : row.them) : hs} label={label}
              per={periodOf(tt >= 3600 ? 3600 : Math.min(tt, 3599.9))} clock={clockText(Math.min(tt, 3599.9))}
              final={phase === 'final' ? (row?.ot ? 'F/OT' : 'FINAL') : null} poss={poss}
              dd={atMoment && mv ? `${DOWN[mv.down]} & ${mv.goal ? 'GOAL' : mv.d}` : null} flash={phase === 'live' ? flash : null} />
          </div>
          {phase === 'live' && <Board a={a} h={h} as={as} hs={hs} />}
          {phase === 'live' && <Live F={F} plays={shown} opp={opp} />}
          {phase === 'moment' && mv && <MomentCard F={F} mv={mv} owner={owner} onPlay={() => { setPhase('play'); sfx('tap') }} />}
          {phase === 'result' && row?.mo && <MomentResult F={F} row={row} mv={mv} />}
          {phase === 'final' && row && <Final F={F} row={row} news={news} owner={owner} onDone={onDone} />}
        </div>
      )}
      {phase === 'play' && mv && <MomentPlay F={F} mv={mv} onDone={played} onSkipAll={skipAll} />}
    </div>,
    document.body,
  )
}

// ── Live: the scoring plays as they happen, newest first ─────────────────────
function PlayRow({ F, p, opp, keyT }) {
  const s = p[1] ? F.team : opp
  const [q, clock] = whenOf(p[0]).split(' ')
  return (
    <div className={`fg-play${p[2] === 0 || p[0] === keyT ? ' is-key' : ''}`} style={fkVars(s)}>
      <span className="fg-play-when"><b>{q}</b>{clock}</span>
      <span className="fg-play-txt">{p[3]}</span>
      <span className="fg-play-pts">{p[2] >= 6 ? 'TD' : p[2] === 3 ? 'FG' : p[2] === 2 ? 'SAF' : 'KEY'}</span>
    </div>
  )
}
function Live({ F, plays, opp }) {
  const list = plays.slice(-4).reverse()
  return (
    <div className="fg-feed" aria-live="polite">
      {list.length ? list.map(p => <PlayRow key={`${p[0]}-${p[3]}`} F={F} p={p} opp={opp} />) : <div className="fg-empty">KICKOFF</div>}
      <small className="fg-tap">TAP TO SKIP</small>
    </div>
  )
}

// ── The moment: the down, the distance, the spot, the clock, the build and the man across from him ─────────
// (who lines up across: a receiver's corner, a back's linebacker, a lineman's edge rusher; on defense the man he's on)
const ACROSS = { qb: ['edge1', 's1'], rb: ['lb1'], wr: ['cb1'], te: ['lb1', 's1'], ol: ['edge1'], db: ['wr1'], dl: ['ol1', 'qb1'], lb: ['rb1', 'te1'] }
function MomentCard({ F, mv, owner, onPlay }) {
  const p = F.teams[F.team].r.find(x => x.i === mv.pid)
  const L = startersOf(F, mv.opp)
  const vs = (ACROSS[p?.p] ?? []).map(k => L[k]).find(Boolean)
  const m = mv.mine - mv.theirs
  const where = m === 0 ? `TIED ${mv.mine}-${mv.theirs}` : m < 0 ? `DOWN ${-m}` : `UP ${m}`
  const def = mv.ball === 'them'
  const ballTeam = def ? mv.opp : F.team
  return (
    <section className="fg-moment" onClick={e => e.stopPropagation()}>
      <Chyron team={ballTeam} tag={`${mv.period === 'OT' ? 'OT' : `Q${mv.period[0]}`} ${mv.clock}`} title={`${TEAM[ballTeam].nick} ball`} sub={mv.goal ? `GOAL TO GO · ${where}` : `AT THE ${mv.spotTxt} · ${where}`} />
      <div className="fg-dd"><b>{DOWN[mv.down]} &amp; {mv.goal ? 'GOAL' : mv.d}</b><span>{def ? 'DEFENSE' : 'OFFENSE'}<small>{mv.clock} LEFT</small></span></div>
      {p && <ManL3 F={F} p={p} team={F.team} owner={owner} size="l" />}
      {vs && <><span className="fg-vs">ACROSS FROM HIM</span><ManL3 F={F} p={vs} team={mv.opp} size="s" /></>}
      <span className="fg-need">{def ? (mv.goal ? 'KEEP THEM OUT' : 'GET A STOP') : mv.goal ? 'PUNCH IT IN' : 'MOVE THE CHAINS'}</span>
      <Go onClick={onPlay}>PLAY IT</Go>
    </section>
  )
}
function MomentPlay({ F, mv, onDone, onSkipAll }) {
  const B = F.builds[mv.b]
  const p = F.teams[F.team].r.find(x => x.i === mv.pid)
  const us = TEAM[F.team], opp = TEAM[mv.opp]
  const def = mv.ball === 'them'
  const cast = useMemo(() => { try { return momentCast(F, mv.opp, mv.pid) } catch { return null } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const line = `${us.short} ${mv.mine === mv.theirs ? `and ${opp.short} tied at ${mv.mine}` : mv.mine < mv.theirs ? `down ${mv.mine}-${mv.theirs} to ${opp.short}` : `up ${mv.mine}-${mv.theirs} on ${opp.short}`}, ${mv.clock} left in the ${mv.period === '4TH' ? '4th' : mv.period}.`
  const dn = DOWN[mv.down].toLowerCase()
  const tail = def ? `${opp.short} has the ball, ${dn} and ${mv.goal ? 'goal' : mv.d}. ${us.short} needs a stop.` : `${dn[0].toUpperCase()}${dn.slice(1)} and ${mv.goal ? 'goal' : mv.d}${mv.goal ? '' : ` at the ${mv.spotTxt}`}.`
  const sit = { us: us.short, them: opp.short, mine: mv.mine, opp: mv.theirs, hoops: false, clock: Math.max(1, Math.round(3600 - mv.t)), clockText: mv.clock, period: mv.period, line, tail, dist: mv.d, ...(def && { stop: true }) }
  const simple = (F.games ?? 'advanced') === 'simple' && SIMPLE_GAMES[mv.game]
  return (
    <div className="fg-mg" onClick={e => e.stopPropagation()}>
      <Suspense fallback={<div className="fg-mg-wait" />}>
        {simple
          ? <MiniGameSimple game={mv.game} build={B.build} pos={p?.p ?? B.pos} seed={mv.seed} situation={sit} onDone={onDone} onSkipAll={onSkipAll} />
          : <MiniGame game={mv.game} build={B.build} pos={p?.p ?? B.pos} seed={mv.seed} team={us} opp={opp} cast={cast} situation={sit} home={mv.home ? 'team' : 'opp'} superBowl={mv.po && F.po?.rd === 3 ? romanOf(F.year - 1965) : null} onDone={onDone} onSkipAll={onSkipAll} />}
      </Suspense>
      {!GAMES[mv.game] && !SIMPLE_GAMES[mv.game] && <Go onClick={() => onDone({ hit: roll(mv.seed) < 0.55 })}>CONTINUE</Go>}
    </div>
  )
}
// what the play was, stamped: the offense's or the defense's side of it
function resultWord(mo, def) {
  const { hit, line, game } = mo
  if (!def) {
    if (hit) return line === 'td' ? 'TOUCHDOWN' : 'FIRST DOWN'
    return line === 'pick' ? 'INTERCEPTED' : line === 'downs' ? 'TURNOVER ON DOWNS' : line === 'held-fg' ? 'HELD TO 3' : 'STOPPED'
  }
  if (hit) return line === 'pick' ? 'INTERCEPTION' : game === 'pass-rush' ? 'SACK' : line === 'downs' ? 'TURNOVER ON DOWNS' : line === 'held-fg' ? 'HELD TO 3' : 'STOPPED'
  return line === 'td' ? 'TOUCHDOWN' : 'FIRST DOWN'
}
function MomentResult({ F, row, mv }) {
  const def = mv?.ball === 'them'
  const t = Math.round(mv?.t ?? 0)
  const play = row.kp.find(p => p[0] >= t)
  const good = row.mo.hit
  return (
    <section className="fg-result">
      <Stamp kind={good ? 'w' : 'l'} big>{resultWord(row.mo, def)}</Stamp>
      {play && <p>{play[3]}</p>}
      <small className="fg-tap">TAP TO GO ON</small>
    </section>
  )
}

// the live board: the two teams and the score, big, counting as it goes
function Board({ a, h, as, hs }) {
  return (
    <div className="fg-board is-live">
      <Side s={a} pts={as} label={TEAM[a].nick.toUpperCase()} />
      <Side s={h} pts={hs} right label={TEAM[h].nick.toUpperCase()} />
    </div>
  )
}

// ── FINAL ────────────────────────────────────────────────────────────────────
function Side({ s, pts, right, lose, label }) {
  const t = TEAM[s]
  return (
    <div className={`fg-board-side${right ? ' is-r' : ''}${lose ? ' is-lose' : ''}`} style={fkVars(s)}>
      <img src={t.logo} alt="" draggable={false} />
      <small>{label}</small>
      <BigNum v={pts} size={74} ms={600} />
    </div>
  )
}
function Final({ F, row, news, owner, onDone }) {
  const res = row.w ? 'w' : row.t ? 't' : 'l'
  const [all, setAll] = useState(false)
  const a = row.home ? row.opp : F.team, h = row.home ? F.team : row.opp
  const as = row.home ? row.them : row.us, hs = row.home ? row.us : row.them
  const kp = row.kp ?? []
  const list = all ? kp : kp.slice(-5)
  const mine = (row.lines ?? []).map(l => ({ ...l, p: F.teams[F.team].r.find(x => x.i === l.pid) })).filter(l => l.p && l.line)
  const star = row.st && !mine.some(l => l.pid === row.st.pid) ? F.teams[F.team].r.find(x => x.i === row.st.pid) : null
  const tag = row.rd != null ? (row.rd === 3 ? `SUPER BOWL ${romanOf(F.year - 1965)}` : row.rd === 2 ? `${CONF_OF[F.team]} CHAMPIONSHIP` : `${ROUNDS[row.rd]} ROUND`) : `WEEK ${row.wk}`
  return (
    <section className="fg-final" onClick={e => e.stopPropagation()}>
      <div className="fg-board">
        <Side s={a} pts={as} lose={!row.t && as < hs} label={TEAM[a].nick.toUpperCase()} />
        <Side s={h} pts={hs} right lose={!row.t && hs < as} label={TEAM[h].nick.toUpperCase()} />
        <Stamp kind={res} big delay={350}>{res === 'w' ? 'W' : res === 't' ? 'T' : 'L'}</Stamp>
      </div>
      <div className="fg-head">
        <Tag tone="line">{tag}{row.ot ? ' · OVERTIME' : ''}</Tag>
        <h2>{row.hl}</h2>
        {row.sub && <p>{row.sub}</p>}
      </div>
      {kp.length > 0 && (
        <div className="fg-feed">
          <Chyron tone="ink" size="s" title="Scoring summary" right={kp.length > 5 ? <button className="fg-more" onClick={() => setAll(x => !x)}>{all ? 'LESS' : `ALL ${kp.length}`}</button> : null} />
          {list.map(p => <PlayRow key={`${p[0]}-${p[3]}`} F={F} p={p} opp={row.opp} />)}
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
      {news.some(n => n.k === 'inj' || n.k === 'sign') && (
        <div className="fg-tags">
          {news.filter(n => n.k === 'inj').map(n => <Tag key={n.pid} tone="inj">{n.n.toUpperCase()}{n.what ? ` (${String(n.what).toUpperCase()})` : ''} · {n.se ? 'OUT FOR THE SEASON' : n.wk >= 4 ? `INJURED RESERVE · ${n.wk} WEEKS` : `OUT ${n.wk} ${n.wk === 1 ? 'WEEK' : 'WEEKS'}`}</Tag>)}
          {news.filter(n => n.k === 'sign').map(n => <Tag key={n.pid} tone="line">SIGNED {n.n.toUpperCase()} OFF THE PRACTICE SQUAD</Tag>)}
        </div>
      )}
      <ActionBar><Go onClick={() => { sfx('tap'); onDone() }}>Continue</Go></ActionBar>
    </section>
  )
}
