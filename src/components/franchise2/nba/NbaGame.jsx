import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TEAM, nick, manOf, momentPlan, momentDone, momentSim, dateText, ROUND_NAME, seriesText } from '../../../lib/franchise2/nba'
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
// a close one stops with about 24 seconds left for the key moment, a real possession (moments.js); then the final.
//   start: { row } a game already played (the log's row) · { pend: true } a moment waiting (F.pend)
export default function NbaGame({ F, act, start, owner, onDone }) {
  const [row, setRow] = useState(start.row ?? null)
  const [phase, setPhase] = useState(start.pend ? 'moment' : 'live')
  const plan = useMemo(() => (start.pend ? momentPlan(F) : null), []) // eslint-disable-line react-hooks/exhaustive-deps
  const finish = r => {
    const before = F.log.length
    act(X => { r ? momentDone(X, plan, r) : momentSim(X, plan) })
    const rw = F.log[F.log.length - 1]
    if (F.log.length > before) { setRow({ ...rw, moment: { plan, hit: !!r?.hit, sim: !r } }); setPhase('final') }
    else onDone()
  }
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

// the moment: where the game is, who has the ball, the man the play is drawn up for
function Moment({ F, plan, onPlay, onSim }) {
  const P = F.pend
  const { situation: S } = plan
  const me = manOf(F, plan.man)
  const a = P.h === F.team ? P.a : F.team
  const h = P.h
  const as = P.h === F.team ? P.them : P.us, hs = P.h === F.team ? P.us : P.them
  const mode = F.moments ?? 'advanced'
  const title = (mode === 'simple' ? SIMPLE_GAMES[plan.game]?.title : null) ?? GAMES[plan.game]?.title ?? 'KEY MOMENT'
  useEffect(() => { sfx('swap'); haptic('medium') }, [])
  return (
    <div className="nb-gd-moment">
      <Scorebug a={a} h={h} as={as} hs={hs} per="4TH" clock={plan.game === "clutch-shot" ? `0:${P.left ?? 24}` : S.clockText} label="KEY MOMENT" />
      <Chyron team={F.team} tag="KEY MOMENT" title={title} sub={S.line.toUpperCase()} />
      <p className="nb-gd-tail">{S.tail}</p>
      {me && <LowerThird name={me.n} pos={me.p} num={me.num} ovr={me.o} photo={manPhoto(F, me)} team={F.team} line={plan.def ? 'ON THE BALL' : 'THE BALL IN HIS HANDS'} />}
      <ActionBar>
        <Go onClick={() => { sfx('tap'); mode === 'off' ? onSim() : onPlay() }}>{mode === 'off' ? 'Sim the possession' : 'Play it'}</Go>
        {mode !== 'off' && <button type="button" className="fh-textbtn" onClick={onSim}>Sim it</button>}
      </ActionBar>
    </div>
  )
}
function Play({ F, plan, onDone }) {
  const mode = F.moments ?? 'advanced'
  const p = { game: plan.game, build: plan.build, seed: plan.seed, team: plan.team, opp: plan.opp, pos: plan.g, cast: plan.cast, situation: plan.situation, autoStart: true, home: F.pend?.h === F.team ? 'team' : 'opp' }
  if (mode === 'simple' && SIMPLE_GAMES[plan.game]) return <MiniGameSimple game={p.game} build={p.build} pos={p.pos} seed={p.seed} situation={p.situation} onDone={onDone} autoStart />
  if (!GAMES[plan.game]) return <MiniGame {...p} sim onDone={onDone} />
  return <MiniGame {...p} onDone={onDone} />
}

function momentLine(F, mo, row) {
  const p = manOf(F, mo.plan.man)
  const n = p ? p.n.split(' ').slice(-1)[0] : 'He'
  if (mo.plan.def) return mo.hit ? `${n} gets the stop` : `${n} can't get the stop`
  return mo.hit ? `${n} scores on the last possession` : `${n} misses on the last possession`
}

// the box score from the hub (NbaGameDay.jsx NbaBoxSheet): both teams, the starters, the bench, who didn't play
export function NbaBox({ F, b, owner, onClose }) { return <NbaBoxSheet F={F} b={b} owner={owner} onClose={onClose} /> }
