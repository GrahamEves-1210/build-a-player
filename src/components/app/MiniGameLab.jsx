import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import MiniGame from './MiniGame'
import MiniGameSimple from './MiniGameSimple'
import { GAMES, PLAYOFF_GAMES, COMBINE_GAMES, momentsOf } from '../../lib/minigames'
import { GAME_IDS } from '../../lib/mg'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { SPORT, gameCast, ensureSport } from '../../lib/career'
import { getProgress } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
import { romanOf } from '../../lib/mg/kit'
import { SPRING_LAYOUT } from '../../lib/motion'
import { sfx } from '../../lib/juice'
import { IconClose } from './icons'
import { LB_LIVE } from '../../lib/lbLive'
import { OL_LIVE } from '../../lib/olLive'
import { SOCCER_LIVE } from '../../lib/soccerLive'
import { BASEBALL_LIVE } from '../../lib/baseballLive'

// Practice (settings menu): any mini game at any grade. Nothing here touches a career.
// ?mg=<game>&v=<grade>&auto=1 opens straight on a game (scripts/mg's browser tests).
// (the game's own 0–11 scale, so the button and the card agree: F 0, D 1, C 3, B 6, A 9, S 11)
const GRADES = [[0, 'F'], [1, 'D'], [3, 'C'], [6, 'B'], [9, 'A'], [11, 'S']]
// (soccer only once it's live: SOCCER_LIVE, or ?soccer=1 on the dev server)
const SPORTS = [['nfl', 'FOOTBALL'], ['bucket', 'BASKETBALL'], ...(SOCCER_LIVE ? [['soccer', 'SOCCER']] : []), ...(BASEBALL_LIVE ? [['baseball', 'BASEBALL']] : [])]
const POS = { nfl: [['QB', 'qb'], ['RB', 'rb'], ['WR', 'wr'], ['TE', 'te'], ['DB', 'db'], ['DL', 'dl'], ...(LB_LIVE ? [['LB', 'lb']] : []), ...(OL_LIVE ? [['OL', 'ol']] : [])], bucket: [['GUARD', 'guard'], ['BIG', 'big']], soccer: [['ST', 'st']], baseball: [['BATTER', 'bat'], ['PITCHER', 'pit']] }
const COMBINE = { nfl: ['forty', 'cone', 'gauntlet', 'bench', 'velo', 'acc'], bucket: ['sprint', 'lane', 'spot', 'vert', 'nbench'], soccer: ['sprint30', 'slalom', 'finishing', 'first-touch'], baseball: ['sixty', 'exit-velo', 'arm-strength', 'pitch-velo', 'spin', 'bullpen'] }

// each game once, under the first position that plays it
function listFor(sport) {
  const seen = new Set()
  const moments = POS[sport].flatMap(([label, pos]) => (PLAYOFF_GAMES[pos] ?? []).filter(g => !seen.has(g) && seen.add(g)).map(g => ({ id: g, tag: POS[sport].filter(([, p]) => momentsOf(p).includes(g)).map(([l]) => l).join(' / ') })))
  // (Fourth & Goal plays differently for each: a row for each)
  // (and Seal the Edge, a tight end's or a lineman's, once the line's in)
  const rows = moments.flatMap(g => (g.id === 'goal-line' ? ['qb', 'rb', 'wr', 'te'].map(role => ({ id: g.id, role, tag: role.toUpperCase() })) : g.id === 'seal' && OL_LIVE ? ['te', 'ol'].map(role => ({ id: g.id, role, tag: role.toUpperCase() })) : [g]))
  return { moments: rows, combine: COMBINE[sport].map(g => ({ id: g, tag: null })) }
}
const gameSport = game => (COMBINE.soccer.includes(game) || PLAYOFF_GAMES.st?.includes(game) ? 'soccer' : COMBINE.baseball.includes(game) || PLAYOFF_GAMES.bat?.includes(game) || PLAYOFF_GAMES.pit?.includes(game) ? 'baseball' : COMBINE.bucket.includes(game) || POS.bucket.some(([, p]) => PLAYOFF_GAMES[p]?.includes(game)) ? 'bucket' : 'nfl')
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
  // (a soccer game only opens once soccer's live)
  const start = GAME_IDS.includes(q.get('mg')) && (SOCCER_LIVE || gameSport(q.get('mg')) !== 'soccer') && (BASEBALL_LIVE || gameSport(q.get('mg')) !== 'baseball') ? q.get('mg') : null
  const [sport, setSport] = useState(() => (start ? gameSport(start) : window.__bapPage?.sport === 'bucket' ? 'bucket' : window.__bapPage?.sport === 'soccer' && SOCCER_LIVE ? 'soccer' : window.__bapPage?.sport === 'baseball' && BASEBALL_LIVE ? 'baseball' : 'nfl'))
  const [v, setV] = useState(() => (q.has('v') ? Number(q.get('v')) : 6))
  const [game, setGame] = useState(start)
  const [auto, setAuto] = useState(q.has('auto'))
  const [run, setRun] = useState(0)
  const [role, setRole] = useState(null)   // Fourth & Goal: which position you're playing
  // the two versions a career can play: Simple (the quick ones) or Advanced (the full games). Kept per device
  // (a ?mg= link, the test tools', opens the full game)
  const [mode, setMode] = useState(() => { if (new URLSearchParams(window.location.search).has('mg')) return 'advanced'; try { return localStorage.getItem('bap_practice_mode') === 'simple' ? 'simple' : 'advanced' } catch { return 'advanced' } })
  const pickMode = m => { setMode(m); try { localStorage.setItem('bap_practice_mode', m) } catch {} ; sfx('tap') }
  const [log, setLog] = useState({})
  const lists = useMemo(() => listFor(sport), [sport])

  // each go is two real teams, drawn at random, with their real rosters
  // (soccer's teams come from its own SPORT entry: until it's there, practice plays in the stock kits)
  const gs = game ? gameSport(game) : sport, S = SPORT[gs], N = S?.teams?.length ?? 0
  const go = useMemo(() => {
    if (N < 2 || !S?.teamOf) return { home: 'team', team: null, opp: null, cast: null }
    const a = Math.floor(Math.random() * N), b = (a + 1 + Math.floor(Math.random() * (N - 1))) % N
    const us = S.teams[a].short, them = S.teams[b].short
    const home = Math.random() < 0.5 ? 'team' : 'opp'
    const name = getUsername(getProgress().user) || 'Guest'
    // (a sport whose cast isn't wired yet plays without real names rather than not at all)
    let cast = null
    try { cast = game ? gameCast({ sport: gs, team: us, pos: posFor(game, gs, role), name, build: {} }, them) : null } catch { cast = null }
    return { home, team: S.teamOf(us), opp: S.teamOf(them), cast }
  }, [game, run, gs, role]) // eslint-disable-line react-hooks/exhaustive-deps
  // soccer before its SPORT entry is in career.js: two real clubs and their real strikers, straight from the data
  // (loaded only when a soccer game opens, so the rosters stay out of everyone else's Practice)
  const [socGo, setSocGo] = useState(null)
  useEffect(() => {
    if (gs !== 'soccer' || N >= 2 || !game) { setSocGo(null); return }
    let live = true
    Promise.all([import('../../data/soccer-clubs.js'), import('../../data/soccer-strikers.js')]).then(([C, P]) => {
      if (!live) return
      const clubs = C.SOCCER_CLUBS, a = Math.floor(Math.random() * clubs.length), b = (a + 1 + Math.floor(Math.random() * (clubs.length - 1))) % clubs.length
      const men = short => P.SOCCER_STRIKERS.filter(p => p.team === short).map(p => ({ name: String(p.short ?? p.name.split(' ').pop()).toUpperCase(), number: p.number, skin: p.skin, speed: Math.max(-1, Math.min(1, ((p.attrs?.pace ?? 6) - 6) / 5)) }))
      const name = String(getUsername(getProgress().user) || 'Guest').trim().split(/\s+/).pop().toUpperCase()
      const us = men(clubs[a].short), me = { name, number: 9, skin: '#8d5a3b', speed: 0, me: true }
      setSocGo({ home: 'team', team: clubs[a], opp: clubs[b], cast: { us: { st: [me, ...us] }, them: { st: men(clubs[b].short) }, me } })
    }).catch(() => {})
    return () => { live = false }
  }, [game, run, gs]) // eslint-disable-line react-hooks/exhaustive-deps
  if (socGo) Object.assign(go, socGo)
  // baseball: its SPORT entry loads with its rosters (lib/careerBaseball.js, only when a baseball game opens). Two real clubs:
  // their lineups and their staffs, every man with his own grades, his side of the plate and his arm, so the at-bat
  // faces a real arsenal and the pitcher a real hitter's zones. (A roster that isn't there yet: the stock look.)
  const [bbGo, setBbGo] = useState(null)
  useEffect(() => {
    if (gs !== 'baseball' || !game) { setBbGo(null); return }
    let live = true
    ensureSport('baseball').then(B => {
      if (!live || !(B?.teams?.length >= 2)) return
      const T = B.teams, a = Math.floor(Math.random() * T.length), b = (a + 1 + Math.floor(Math.random() * (T.length - 1))) % T.length
      // (his last name: the data's short name only when it is one, never a nickname, as career's cast does)
      const last = p => { const sh = String(p.short ?? '').replace(/^[A-Z].s*/, ''), nm = String(p.name).replace(/s+(Jr.?|Sr.?|II|III|IV|V)$/i, ''); return (sh && nm.endsWith(sh) ? sh : nm.split(' ').pop()).toUpperCase() }
      const man = p => ({ name: last(p), number: p.number, skin: p.skin, speed: Math.max(-1, Math.min(1, ((p.attrs?.speed ?? 6) - 6) / 5)), bats: p.bats, throws: p.throws, attrs: p.attrs, role: p.role })
      const side = short => ({ bat: (B.pool.bat ?? []).filter(p => p.team === short).sort((x, y) => (y.starter ? 1 : 0) - (x.starter ? 1 : 0) || (y.attrs?.power ?? 0) - (x.attrs?.power ?? 0)).map(man), pit: (B.pool.pit ?? []).filter(p => p.team === short).sort((x, y) => (y.starter ? 1 : 0) - (x.starter ? 1 : 0)).map(man) })
      const us = side(T[a].short), them = side(T[b].short), at = posFor(game, 'baseball', null)
      const me = { name: String(getUsername(getProgress().user) || 'Guest').trim().split(/s+/).pop().toUpperCase(), number: at === 'pit' ? 34 : 27, skin: '#8d5a3b', speed: 0, me: true }
      us[at] = [me, ...us[at]]
      setBbGo({ home: 'team', team: B.teamOf(T[a].short), opp: B.teamOf(T[b].short), cast: { us, them, me } })
    }).catch(() => {})
    return () => { live = false }
  }, [game, run, gs]) // eslint-disable-line react-hooks/exhaustive-deps
  if (bbGo) Object.assign(go, bbGo)
  const { team, opp } = go
  const res = game ? log[`${game}-${run}`] : null
  const back = () => { setGame(null); setAuto(false); sfx('back') }
  const again = () => { setRun(r => r + 1); setAuto(true); sfx('tap') }

  if (game && mode === 'simple' && SIMPLE_GAMES[game]) return (
    <div className="ag-screen pr-screen">
      <div className="pr-wrap">
        <div className="pr-stagebar pr-stagebar--simple"><button onClick={back}>EXIT</button><button onClick={again}>AGAIN</button></div>
        <MiniGameSimple key={`${game}-${v}-${run}`} game={game} pos={role} build={null} labV={v} seed={`lab-${run}`} autoStart={auto}
          onDone={r => setLog(l => ({ ...l, [`${game}-${run}`]: r, [game]: r }))} />
        <div className="pr-after">
          {res && <button className="ag-btn" onClick={again}>GO AGAIN</button>}
          <button className="ag-btn ag-btn--ghost" onClick={back}>ALL GAMES</button>
        </div>
      </div>
    </div>
  )
  if (game) return (
    <div className="ag-screen pr-screen">
      <div className="pr-wrap">
        <MiniGame home={go.home} superBowl={import.meta.env.DEV && q.has('sb') ? romanOf(61) : null} key={`${game}-${v}-${run}-${cast ? 1 : 0}${socGo ? 's' : ''}${bbGo ? 'b' : ''}`} cast={cast ?? go.cast} game={game} build={null} labV={v} seed={`practice-${game}-${run}`} autoStart={auto} team={team} opp={opp} pos={role ?? (import.meta.env.DEV ? q.get('pos') : null)}
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
        <div className="ag-seg pr-mode" role="tablist" aria-label="Version">
          {[['advanced', 'ADVANCED'], ['simple', 'SIMPLE']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'is-on' : ''} onClick={() => pickMode(id)}>
              {mode === id && <motion.span layoutId="pr-mode" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
              {label}
            </button>
          ))}
        </div>
        <div className="pr-grade" role="radiogroup" aria-label="Grade">
          <span>GRADE</span>
          {GRADES.map(([n, g]) => <button key={n} role="radio" aria-checked={v === n} className={v === n ? 'is-on' : ''} onClick={() => { setV(n); sfx('tap') }}>{g}</button>)}
        </div>
        <section className="pr-sec"><h2>Key Moments</h2>{lists.moments.map(g => <Row key={g.id + (g.role ?? '')} {...g} />)}</section>
        <section className="pr-sec"><h2>{sport === 'soccer' ? 'Academy Trial' : sport === 'baseball' ? 'Showcase' : 'Combine'}</h2>{lists.combine.map(g => <Row key={g.id} {...g} />)}</section>
      </div>
    </div>
  )
}
