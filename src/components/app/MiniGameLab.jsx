import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import MiniGame from './MiniGame'
import { GAMES, PLAYOFF_GAMES, COMBINE_GAMES, momentsOf } from '../../lib/minigames'
import { GAME_IDS } from '../../lib/mg'
import { SPORT, gameCast } from '../../lib/career'
import { getProgress } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
import { romanOf } from '../../lib/mg/kit'
import { SPRING_LAYOUT } from '../../lib/motion'
import { sfx } from '../../lib/juice'
import { IconClose } from './icons'

// Practice (settings menu): any mini game at any grade. Nothing here touches a career.
// ?mg=<game>&v=<grade>&auto=1 opens straight on a game (scripts/mg's browser tests).
const GRADES = [[1, 'F'], [3, 'D'], [5, 'C'], [7, 'B'], [9, 'A'], [11, 'S']]
const SPORTS = [['nfl', 'FOOTBALL'], ['bucket', 'BASKETBALL']]
const POS = { nfl: [['QB', 'qb'], ['RB', 'rb'], ['WR', 'wr'], ['TE', 'te'], ['DB', 'db'], ['DL', 'dl']], bucket: [['GUARD', 'guard'], ['BIG', 'big']] }
const COMBINE = { nfl: ['forty', 'cone', 'gauntlet', 'bench', 'velo', 'acc'], bucket: ['sprint', 'lane', 'spot', 'vert', 'nbench'] }

// each game once, under the first position that plays it
function listFor(sport) {
  const seen = new Set()
  const moments = POS[sport].flatMap(([label, pos]) => (PLAYOFF_GAMES[pos] ?? []).filter(g => !seen.has(g) && seen.add(g)).map(g => ({ id: g, tag: POS[sport].filter(([, p]) => momentsOf(p).includes(g)).map(([l]) => l).join(' / ') })))
  // (Fourth & Goal plays differently for each: a row for each)
  const rows = moments.flatMap(g => (g.id === 'goal-line' ? ['qb', 'rb', 'wr', 'te'].map(role => ({ id: g.id, role, tag: role.toUpperCase() })) : [g]))
  return { moments: rows, combine: COMBINE[sport].map(g => ({ id: g, tag: null })) }
}
const gameSport = game => (COMBINE.bucket.includes(game) || POS.bucket.some(([, p]) => PLAYOFF_GAMES[p]?.includes(game)) ? 'bucket' : 'nfl')
// who plays a game: the first position that has it
const posFor = (game, sport, role) => role ?? POS[sport].map(([, p]) => p).find(p => PLAYOFF_GAMES[p]?.includes(game) || COMBINE_GAMES[p]?.includes(game)) ?? POS[sport][0][1]

export default function MiniGameLab({ onClose }) {
  // (dev only: ?cast=CIN,PIT,qb,nfl puts real rosters on the field, to look at them)
  const [cast, setCast] = useState(null)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const q = new URLSearchParams(window.location.search).get('cast')
    if (!q) return
    const [team, opp, pos = 'qb', sport = 'nfl'] = q.split(',')
    import('../../lib/career').then(m => setCast(m.gameCast({ sport, team, pos, name: 'Guest', build: {} }, opp)))
  }, [])
  const q = new URLSearchParams(window.location.search)
  const start = GAME_IDS.includes(q.get('mg')) ? q.get('mg') : null
  const [sport, setSport] = useState(() => (start ? gameSport(start) : window.__bapPage?.sport === 'bucket' ? 'bucket' : 'nfl'))
  const [v, setV] = useState(() => Number(q.get('v')) || 5)
  const [game, setGame] = useState(start)
  const [auto, setAuto] = useState(q.has('auto'))
  const [run, setRun] = useState(0)
  const [role, setRole] = useState(null)   // Fourth & Goal: which position you're playing
  const [log, setLog] = useState({})
  const lists = useMemo(() => listFor(sport), [sport])

  // each go is two real teams, drawn at random, with their real rosters
  const gs = game ? gameSport(game) : sport, S = SPORT[gs], N = S.teams.length
  const go = useMemo(() => {
    const a = Math.floor(Math.random() * N), b = (a + 1 + Math.floor(Math.random() * (N - 1))) % N
    const us = S.teams[a].short, them = S.teams[b].short
    const home = Math.random() < 0.5 ? 'team' : 'opp'
    const name = getUsername(getProgress().user) || 'Guest'
    return { home, team: S.teamOf(us), opp: S.teamOf(them), cast: game ? gameCast({ sport: gs, team: us, pos: posFor(game, gs, role), name, build: {} }, them) : null }
  }, [game, run, gs, role]) // eslint-disable-line react-hooks/exhaustive-deps
  const { team, opp } = go
  const res = game ? log[`${game}-${run}`] : null
  const back = () => { setGame(null); setAuto(false); sfx('back') }
  const again = () => { setRun(r => r + 1); setAuto(true); sfx('tap') }

  if (game) return (
    <div className="ag-screen pr-screen">
      <div className="pr-wrap">
        <MiniGame home={go.home} superBowl={import.meta.env.DEV && q.has('sb') ? romanOf(61) : null} key={`${game}-${v}-${run}-${cast ? 1 : 0}`} cast={cast ?? go.cast} game={game} build={null} labV={v} seed={`practice-${game}-${run}`} autoStart={auto} team={team} opp={opp} pos={role ?? (import.meta.env.DEV ? q.get('pos') : null)}
          onDone={r => setLog(l => ({ ...l, [`${game}-${run}`]: r, [game]: r }))}>
          <div className="pr-stagebar"><button onClick={back}>EXIT</button><button onClick={again}>AGAIN</button></div>
        </MiniGame>
        <div className="pr-after">
          {res && <button className="ag-btn" onClick={again}>GO AGAIN</button>}
          <button className="ag-btn ag-btn--ghost" onClick={back}>ALL GAMES</button>
        </div>
      </div>
    </div>
  )

  const Row = ({ id, tag, role: rowRole = null }) => {
    const r = log[id]
    return (
      <button className="pr-row" onClick={() => { setRole(rowRole); setGame(id); setAuto(false); setRun(n => n + 1); sfx('tap') }}>
        <b>{GAMES[id]?.title}</b>
        {tag && <i>{tag}</i>}
        {r && <span className={r.hit ? 'is-hit' : 'is-miss'}>{r.hit ? 'MADE IT' : 'MISSED'}</span>}
      </button>
    )
  }
  return (
    <div className="ag-screen pr-screen">
      <div className="pr-wrap">
        <header className="pr-top">
          <h1 className="ag-h1">Practice</h1>
          <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </header>
        <div className="ag-seg" role="tablist" aria-label="Sport">
          {SPORTS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={sport === id} className={sport === id ? 'is-on' : ''} onClick={() => { setSport(id); sfx('tap') }}>
              {sport === id && <motion.span layoutId="pr-sport" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
              {label}
            </button>
          ))}
        </div>
        <div className="pr-grade" role="radiogroup" aria-label="Grade">
          <span>GRADE</span>
          {GRADES.map(([n, g]) => <button key={n} role="radio" aria-checked={v === n} className={v === n ? 'is-on' : ''} onClick={() => { setV(n); sfx('tap') }}>{g}</button>)}
        </div>
        <section className="pr-sec"><h2>Key Moments</h2>{lists.moments.map(g => <Row key={g.id + (g.role ?? '')} {...g} />)}</section>
        <section className="pr-sec"><h2>Combine</h2>{lists.combine.map(g => <Row key={g.id} {...g} />)}</section>
      </div>
    </div>
  )
}
