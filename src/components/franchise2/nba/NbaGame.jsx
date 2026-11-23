import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, nick, manOf, momentPlan, momentDone, momentSim, momentText, dateText, seriesText, poTag } from '../../../lib/franchise2/nba'
import { markBuildPage } from '../../../lib/buildSave'
import { manPhoto } from './NbaBuilds'
import { sfx, haptic } from '../../../lib/juice'
import { GAMES } from '../../../lib/minigames'
import { SIMPLE_GAMES } from '../../../lib/minigamesSimple'
import MiniGame from '../../app/MiniGame'
import MiniGameSimple from '../../app/MiniGameSimple'
import { BoxSheet } from '../../app/SquadSeason'
import { fkVars, KLogo, Scorebug, Stamp, Go, ActionBar, Chyron, LowerThird, reduced } from '../kit'
import { photoOf } from '../../../lib/franchise2/nba'

// GAME DAY: the GM's game as a broadcast. The scorebug runs the game a quarter at a time (a tap skips to the end);
// a close one stops at a whistle in the last 24 seconds for the key moment, a real possession (moments.js); then the
// final.
//   start: { row } a game already played (the log's row) · { pend: true } a moment waiting (F.pend)
// A mini game left before it finished (a reload, a closed tab) is a miss: MiniGame's lock, and the moment's screen
// books it the moment it opens again (the game is seeded: a replay would be a free practice run)
const lockOf = plan => `nba-${plan.seed}`
const wasLeft = plan => { try { return !!localStorage.getItem(`bap_mg_${lockOf(plan)}`) } catch { return false } }
export default function NbaGame({ F, act, start, owner, onDone }) {
  const [row, setRow] = useState(start.row ?? null)
  const plan = useMemo(() => (start.pend ? momentPlan(F) : null), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState(start.pend ? (plan && wasLeft(plan) ? 'left' : 'moment') : 'live')
  const finish = (r, left = false) => {
    const before = F.log.length
    act(X => { r ? momentDone(X, plan, r) : momentSim(X, plan) })
    const rw = F.log[F.log.length - 1]
    if (F.log.length > before) { setRow({ ...rw, moment: { plan, hit: !!r?.hit, sim: !r, left } }); setPhase('final') }
    else onDone()
  }
  const booked = useRef(false)
  useEffect(() => {
    if (phase !== 'left' || booked.current) return
    booked.current = true
    try { localStorage.removeItem(`bap_mg_${lockOf(plan)}`) } catch {}
    finish({ hit: false, raw: null, out: false }, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="fk-root fk nb-gd" style={fkVars(F.team)} role="dialog" aria-label="Game">
      {phase === 'live' && row && <Live F={F} row={row} onEnd={() => setPhase('final')} />}
      {phase === 'moment' && plan && <Moment F={F} plan={plan} onPlay={() => setPhase('play')} onSim={() => finish(null)} />}
      {phase === 'play' && plan && <Play F={F} plan={plan} onDone={finish} />}
      {phase === 'final' && row && <Final F={F} row={row} owner={owner} onDone={onDone} />}
    </div>,
    document.body,
  )
}
const sides = (F, row) => { const a = row.home ? row.opp : F.team, h = row.home ? F.team : row.opp; return { a, h, as: row.home ? row.them : row.us, hs: row.home ? row.us : row.them } }

// the quarters ticking on: 4 beats (and the overtimes), each about 0.6 s
function Live({ F, row, onEnd }) {
  const { a, h } = sides(F, row)
  const q = F.box?.[row.bx]?.q ?? null
  const n = q?.length ?? 4
  const [k, setK] = useState(reduced() ? n : 0)
  const end = useRef(onEnd); end.current = onEnd
  useEffect(() => {
    if (k >= n) { const t = setTimeout(() => end.current(), 500); return () => clearTimeout(t) }
    const t = setTimeout(() => { setK(k + 1); sfx('tick') }, k === 0 ? 350 : 620)
    return () => clearTimeout(t)
  }, [k, n])
  const hIdx = 0, aIdx = 1
  const sum = i => (q ? q.slice(0, k).reduce((x, y) => x + (y[i] ?? 0), 0) : 0)
  const hs = q ? sum(hIdx) : (k >= n ? sides(F, row).hs : 0), as = q ? sum(aIdx) : (k >= n ? sides(F, row).as : 0)
  const per = k >= n ? null : k === 0 ? '1ST' : k <= 4 ? ['1ST', '2ND', '3RD', '4TH'][k - 1] : `${k - 4 > 1 ? k - 4 : ''}OT`
  return (
    <div className="nb-gd-live" onClick={() => setK(n)}>
      <Chyron team={F.team} tag={row.po ?? dateText(F, row.d)} title={`${nick(a)} at ${nick(h)}`} />
      <Scorebug a={a} h={h} as={as} hs={hs} per={per} clock={k === 0 ? '12:00' : 'END'} final={k >= n ? (row.ot ? 'F/OT' : 'FINAL') : null} />
      <small className="fg-tap">TAP TO SKIP</small>
    </div>
  )
}

// the moment: where the game is (the real clock and period), who has the ball, the man the play is drawn up for, and
// in the playoffs where the series stands
function Moment({ F, plan, onPlay, onSim }) {
  const P = F.pend
  const { situation: S } = plan
  const me = manOf(F, plan.man)
  const a = P.h === F.team ? P.a : F.team
  const h = P.h
  const as = P.h === F.team ? S.opp : S.mine, hs = P.h === F.team ? S.mine : S.opp
  const ballSide = (plan.def ? h !== F.team : h === F.team) ? 'h' : 'a'
  const mode = F.moments ?? 'advanced'
  const title = (mode === 'simple' ? SIMPLE_GAMES[plan.game]?.title : null) ?? GAMES[plan.game]?.title ?? 'KEY MOMENT'
  const tag = P.po != null ? (poTag(F) === 'PLAY-IN' ? 'PLAY-IN' : P.n ? `GAME ${P.n}` : 'PLAYOFFS') : 'KEY MOMENT'
  const role = plan.spot === 'ft' ? 'AT THE LINE' : plan.def ? 'ON THE BALL' : 'LAST SHOT'
  useEffect(() => { sfx('swap'); haptic('medium') }, [])
  return (
    <div className="nb-gd-moment">
      <Scorebug a={a} h={h} as={as} hs={hs} per={S.period} clock={S.clockText} poss={ballSide} label="KEY MOMENT" />
      <Chyron team={F.team} tag={tag} title={title} sub={S.line.toUpperCase()} />
      {S.series && <p className="nb-gd-tail">{S.series}</p>}
      <p className="nb-gd-tail">{S.tail}</p>
      {me && <LowerThird name={me.n} pos={me.p} num={me.num} ovr={me.o} photo={manPhoto(F, me)} team={F.team} line={role} />}
      <ActionBar>
        <Go onClick={() => { sfx('tap'); mode === 'off' ? onSim() : onPlay() }}>{mode === 'off' ? 'Sim the possession' : 'Play it'}</Go>
        {mode !== 'off' && <button type="button" className="fh-textbtn" onClick={onSim}>Sim it</button>}
      </ActionBar>
    </div>
  )
}
// the mini game: the five on the floor on both sides, the real score and clock. The how-to (MiniGame's intro) shows the
// first time he plays each game here, then it starts straight away. The lock books a run he leaves as a miss, and a
// reload comes back to basketball Franchise (lib/buildSave.js; main.jsx puts a reload on /minigame back where it was)
const SEEN = 'bap_nba_mg_seen'
const seenOf = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]') } catch { return [] } }
function Play({ F, plan, onDone }) {
  const mode = F.moments ?? 'advanced'
  const [auto] = useState(() => seenOf().includes(`${mode === 'simple' ? 's:' : ''}${plan.game}`))
  useEffect(() => {
    markBuildPage('bucket', 'nbafranchise')
    try { sessionStorage.setItem('bap_frnba_moment', String(F.slot ?? 0)) } catch {}
    try { const k = `${mode === 'simple' ? 's:' : ''}${plan.game}`, l = seenOf(); if (!l.includes(k)) localStorage.setItem(SEEN, JSON.stringify([...l, k])) } catch {}
    return () => { try { sessionStorage.removeItem('bap_frnba_moment') } catch {} }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const lock = lockOf(plan)
  const p = { game: plan.game, build: plan.build, seed: plan.seed, team: plan.team, opp: plan.opp, pos: plan.g, cast: plan.cast, situation: plan.situation, autoStart: auto, lock, home: F.pend?.h === F.team ? 'team' : 'opp' }
  if (mode === 'simple' && SIMPLE_GAMES[plan.game]) return <MiniGameSimple game={p.game} build={p.build} pos={p.pos} seed={p.seed} situation={p.situation} onDone={onDone} autoStart={auto} lock={lock} />
  if (!GAMES[plan.game]) return <MiniGame {...p} sim onDone={onDone} />
  return <MiniGame {...p} onDone={onDone} />
}

// THE FINAL: the W or L, the score, the line a broadcaster gives it, the best man on each side
function Final({ F, row, owner, onDone }) {
  const { a, h, as, hs } = sides(F, row)
  const b = F.box?.[row.bx]
  const [box, setBox] = useState(false)
  const top = s => (b?.box?.[s] ?? []).slice().sort((x, y) => y.pts - x.pts)[0]
  const S = row.po && F.po?.S ? F.po.S.find(x => x.hi === F.team || x.lo === F.team) : null
  const head = `${nick(row.w ? F.team : row.opp)} ${Math.max(row.us, row.them)}, ${nick(row.w ? row.opp : F.team)} ${Math.min(row.us, row.them)}${row.ot ? (row.ot > 1 ? ` (${row.ot}OT)` : ' (OT)') : ''}`
  const mo = row.moment
  return (
    <div className="nb-gd-final">
      <Scorebug a={a} h={h} as={as} hs={hs} final={row.ot ? 'F/OT' : 'FINAL'} />
      <div className="nb-gd-stamp"><Stamp kind={row.w ? 'w' : 'l'} big>{row.w ? 'W' : 'L'}</Stamp></div>
      <h2 className="nb-gd-head">{head}</h2>
      {S && <p className="nb-gd-sub">{seriesText(S, F.team)}</p>}
      {mo && <p className="nb-gd-sub">{momentLine(F, mo, row)}</p>}
      <div className="nb-gd-tops">
        {[F.team, row.opp].map(s => { const l = top(s); const p = l && manOf(F, l.i); return p ? <LowerThird key={s} name={p.n} pos={p.p} num={p.num} photo={manPhoto(F, p)} team={s} size="s" stat={{ v: l.pts, label: 'PTS' }} line={`${l.reb} REB · ${l.ast} AST`} /> : null })}
      </div>
      {b && <button type="button" className="fh-textbtn" onClick={() => { setBox(true); sfx('tap') }}>Box score</button>}
      {box && <NbaBox F={F} b={b} owner={owner} onClose={() => setBox(false)} />}
      <ActionBar><Go onClick={() => { sfx('tap'); onDone() }}>Continue</Go></ActionBar>
    </div>
  )
}
// the moment's line, from what happened on the board (moments.js momentText)
function momentLine(F, mo, row) {
  const t = momentText(F, row)
  return `${mo.left ? 'Left before it finished: counted as a miss. ' : ''}${t ?? ''}`
}

// the box score (SquadSeason's BoxSheet, basketball): the GM's team's men, their minutes and their lines
export function NbaBox({ F, b, owner, onClose }) {
  const s = F.team, opp = b.h === s ? b.a : b.h
  const home = b.h === s
  const men = (b.box?.[s] ?? [])
  const roster = men.map(l => { const p = manOf(F, l.i); return { k: String(l.i), n: p?.n ?? '-', s: p?.b != null, pos: 'bat', tag: p?.p ?? '' } })   // (roleOf reads a tag off 'bat': his spot, PG to C)
  const sumOf = list => list.reduce((x, l) => { for (const k of ['fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'reb', 'ast', 'stl', 'blk', 'tov']) x[k] = (x[k] ?? 0) + (l[k] ?? 0); return x }, {})
  const us = sumOf(men), them = sumOf(b.box?.[opp] ?? [])
  us.to = us.tov; them.to = them.tov
  const game = { s: Object.fromEntries(men.map(l => [String(l.i), { ...l, mn: l.min }])), us, them }
  const r = { team: s, roster }
  const my = home ? b.hs : b.as, op = home ? b.as : b.hs
  const q = b.q ? [b.q.map(x => x[home ? 0 : 1]), b.q.map(x => x[home ? 1 : 0])] : null
  const g = { i: 0, opp, home, my, op, ot: b.ot, po: false }
  return <BoxSheet r={r} sport="bucket" g={g} box={{ reg: [game], po: [] }} owner={owner} onClose={onClose} quarters={q} />
}
