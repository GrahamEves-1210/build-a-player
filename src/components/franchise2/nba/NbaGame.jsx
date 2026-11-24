import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, nick, manOf, momentPlan, momentDone, momentSim, momentText, dateText, seriesText, poTag } from '../../../lib/franchise2/nba'
import { markBuildPage } from '../../../lib/buildSave'
import { manPhoto } from './NbaBuilds'
import { sfx, haptic } from '../../../lib/juice'
import { GAMES } from '../../../lib/minigames'
import { logOf } from '../../../lib/franchise2/nba/game'
import GameDay, { NbaBoxSheet } from './NbaGameDay'
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
  // GAME DAY (NbaGameDay.jsx): the live game and the final on football's layout. A moment's game is shown up to its
  // whistle first, when this session played it and kept its log
  const [pre, setPre] = useState(() => phase === 'moment' && !!logOf(F.pend?.G)?.length)
  if (pre) return createPortal(<GameDay key="pend" F={F} pend={F.pend} owner={owner} onEnd={() => setPre(false)} onDone={onDone} />, document.body)
  if ((phase === 'live' || phase === 'final') && row) return createPortal(<GameDay key="row" F={F} row={row} fin={phase === 'final'} owner={owner} moLine={row.moment ? momentLine(F, row.moment, row) : null} onEnd={() => setPhase('final')} onDone={onDone} />, document.body)
  return createPortal(
    <div className="fk-root fk nb-gd" style={fkVars(F.team)} role="dialog" aria-label="Game">
      {phase === 'moment' && plan && <Moment F={F} plan={plan} onPlay={() => setPhase('play')} onSim={() => finish(null)} />}
      {phase === 'play' && plan && <Play F={F} plan={plan} onDone={finish} />}
    </div>,
    document.body,
  )
}
const sides = (F, row) => { const a = row.home ? row.opp : F.team, h = row.home ? F.team : row.opp; return { a, h, as: row.home ? row.them : row.us, hs: row.home ? row.us : row.them } }

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
  const p = { game: plan.game, build: plan.build, seed: plan.seed, team: plan.team, opp: plan.opp, pos: plan.g, cast: plan.cast, demoCast: true, situation: plan.situation, autoStart: auto, lock, home: F.pend?.h === F.team ? 'team' : 'opp' }
  if (mode === 'simple' && SIMPLE_GAMES[plan.game]) return <MiniGameSimple game={p.game} build={p.build} pos={p.pos} seed={p.seed} situation={p.situation} onDone={onDone} autoStart={auto} lock={lock} />
  if (!GAMES[plan.game]) return <MiniGame {...p} sim onDone={onDone} />
  return <MiniGame {...p} onDone={onDone} />
}

// the moment's line, from what happened on the board (moments.js momentText)
function momentLine(F, mo, row) {
  const t = momentText(F, row)
  return `${mo.left ? 'Left before it finished: counted as a miss. ' : ''}${t ?? ''}`
}

// the box score from the hub (NbaGameDay.jsx NbaBoxSheet): both teams, the starters, the bench, who didn't play
export function NbaBox({ F, b, owner, onClose }) { return <NbaBoxSheet F={F} b={b} owner={owner} onClose={onClose} /> }
