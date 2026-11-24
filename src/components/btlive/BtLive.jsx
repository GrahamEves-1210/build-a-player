// (BucketApp mounts it behind lib/btLive.js BT_LIVE_OPEN: only at /bucket?btlive=1, on since 2026-11-24): BLACKTOP LIVE,
// the real-time prototype of Blacktop. Practice against the CPU, on this device: nothing here touches the live
// server, an account, a record or today's Blacktop.
//   /bucket?btlive=1                      the practice menu
//   &mode=1v1|2v2|koth (King of the Hill)  &level=rookie|pro|allstar|legend  &pick=<player name>  &seed=abc
//   &go=1 (straight into a game). An old &size=1|2 still works; &size=3 (3v3, gone) opens 1v1
// The game itself is lib/btlive (pure code); engine.js runs and draws it. On the dev server the running game is
// on window.__btlive (state, pause, run, auto, press, stick, wait) for screenshots and tests.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCourt } from '../app/BlacktopCourt'
import { buildFromPlayer } from '../../lib/hoops'
import { getUsername } from '../../lib/discord'
import { sfx } from '../../lib/juice'
import { seeded } from '../../lib/rng'
import { calcBucketOVR } from '../../utils/bucketSimulation'
import { BUCKET_ATTR } from '../../data/nba-attrs'
import { GUARD_KEYS, BIG_KEYS, LEVELS, RULES, MODES, MODE_KEYS, modeKey } from '../../lib/btlive/index.js'
import { createEngine } from './engine'
import { openNet, netFromUrl } from './net'
import './btlive.css'

// the practice builds: real players' ratings, a spread of games to try (a shooter, a slasher, a stopper, bigs)
const PRESETS = [
  ['guard', 'Stephen Curry'], ['guard', 'Shai Gilgeous-Alexander'], ['guard', 'Anthony Edwards'], ['guard', 'Dyson Daniels'],
  ['big', 'Nikola Jokic'], ['big', 'Victor Wembanyama'], ['big', 'Giannis Antetokounmpo'], ['big', 'Rudy Gobert'],
]
const LEVEL_KEYS = Object.keys(LEVELS)
const KEEP = 'bap_btlive_practice'
const keysFor = pos => (pos === 'big' ? BIG_KEYS : GUARD_KEYS)
const ovrOf = (p, pos) => calcBucketOVR(buildFromPlayer(p, keysFor(pos)), keysFor(pos), pos)
// his three best ratings, as the build screens name them
const best3 = (p, pos) => keysFor(pos).map(k => [k, p.attrs?.[k] ?? 0]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${BUCKET_ATTR[k]?.shortLabel ?? k} ${v}`)

function Face({ p, size = 38 }) {
  const fc = p.faceCenter
  return <span className="btlv-face" style={{ width: size, height: size }}>{p.photo && <img src={p.photo} alt="" draggable={false} style={fc ? { objectPosition: `${fc[0]}% ${fc[1]}%` } : undefined} />}</span>
}

export default function BtLive({ pools, user }) {
  const q = useMemo(() => new URLSearchParams(window.location.search), [])
  const name = getUsername(user) || 'Guest'
  const presets = useMemo(() => PRESETS.map(([pos, n]) => { const p = pools[pos]?.find(x => x.name === n); return p ? { pos, p, ovr: ovrOf(p, pos) } : null }).filter(Boolean), [pools])
  const kept = useMemo(() => { try { return JSON.parse(localStorage.getItem(KEEP) || '{}') } catch { return {} } }, [])
  const [mode, setMode] = useState(() => modeKey(q.get('mode') || q.get('size') || kept.mode || kept.size))
  const size = MODES[mode].perTeam
  const [level, setLevel] = useState(() => { const v = q.get('level') || kept.level; return LEVEL_KEYS.includes(v) ? v : 'pro' })
  const [pick, setPick] = useState(() => { const v = q.get('pick') || kept.pick; return presets.some(x => x.p.name === v) ? v : presets[0]?.p.name })
  const [game, setGame] = useState(null)          // { key, setup }: a game in progress
  useEffect(() => { try { localStorage.setItem(KEEP, JSON.stringify({ mode, level, pick })) } catch {} }, [mode, level, pick])

  const start = (seed = null) => {
    const mine = presets.find(x => x.p.name === pick) ?? presets[0]
    if (!mine) return
    const sd = seed || q.get('seed') || `p${Date.now().toString(36)}`
    const r = seeded(`btlive-${sd}`)
    // the other players: real builds near his overall, a guard and a big where there's room
    const used = new Set([mine.p.name])
    const near = pos => {
      const list = pools[pos].filter(p => !used.has(p.name) && p.photo && Math.abs(ovrOf(p, pos) - mine.ovr) <= 4)
      const from = list.length ? list : pools[pos].filter(p => !used.has(p.name))
      const p = from[Math.floor(r() * from.length)]
      used.add(p.name)
      return { pos, p }
    }
    const other = mine.pos === 'big' ? 'guard' : 'big'
    // King of the Hill: him and two CPUs at his position; 2v2: a CPU teammate at the other one, a guard and a big
    const sides = mode === 'koth' ? [[mine], [near(mine.pos)], [near(mine.pos)]]
      : mode === '2v2' ? [[mine, near(other)], [near('guard'), near('big')]] : [[mine], [near(mine.pos)]]
    const mk = (x, t, i) => ({ id: `t${t}p${i}`, name: x.p.short || x.p.name, pos: x.pos, build: buildFromPlayer(x.p, keysFor(x.pos)) })
    const all = sides.flat()
    setGame({
      key: sd + Math.random(),
      setup: {
        teams: sides.map((list, t) => list.map((x, i) => mk(x, t, i))),
        levels: all.map((_, i) => (i === 0 ? null : level)),
        me: 0, seed: sd, size: MODES[mode].perTeam, mode, level,
        looks: all.map((x, i) => ({ label: i === 0 ? name : (x.p.short || x.p.name), photo: x.p.photo, faceCenter: x.p.faceCenter })),
        names: mode === 'koth' ? all.map((x, i) => (i === 0 ? name : (x.p.short || x.p.name))) : [name, `CPU ${LEVELS[level].label}`],
      },
    })
  }
  // a rematch: the same game with the same men (the same CPUs, the same builds), only the seed is new
  const rematch = () => setGame(g => { const sd = `r${Date.now().toString(36)}`; return { key: sd + Math.random(), setup: { ...g.setup, seed: sd } } })
  useEffect(() => { if (q.get('go') && presets.length) start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // DEV: online against a local referee (wrangler dev): ?btserver=ws://localhost:8787&btroom=TEST01 (net.js)
  const netCfg = useMemo(() => netFromUrl(q), [q])
  if (netCfg && presets.length) {
    const mine = presets.find(x => x.p.name === pick) ?? presets[0]
    return <Online cfg={netCfg} q={q} mine={mine} pools={pools} mode={mode} name={name} />
  }

  if (game) return <Game key={game.key} setup={game.setup} name={name} onMenu={() => setGame(null)} onRematch={rematch} />

  const groups = [['GUARDS', presets.filter(x => x.pos === 'guard')], ['BIGS', presets.filter(x => x.pos === 'big')]]
  return (
    <div className="btlv btlv-menu">
      <header className="btlv-menu-head">
        <a className="btlv-exit" href="/bucket">EXIT</a>
        <h1>BLACKTOP LIVE</h1>
        <span className="btlv-tag">PRACTICE</span>
      </header>
      <div className="btlv-menu-body">
        <section>
          <h2>GAME</h2>
          <div className="btlv-seg">{MODE_KEYS.map(k => <button key={k} className={k === mode ? 'is-on' : ''} onClick={() => { setMode(k); sfx('tap') }}>{MODES[k].label}</button>)}</div>
        </section>
        <section>
          <h2>BUILD</h2>
          {groups.map(([label, list]) => (
            <div key={label} className="btlv-builds">
              <h3>{label}</h3>
              {list.map(x => (
                <button key={x.p.name} className={`btlv-build${x.p.name === pick ? ' is-on' : ''}`} onClick={() => { setPick(x.p.name); sfx('tap') }}>
                  <Face p={x.p} />
                  <span className="btlv-build-name">{x.p.name}</span>
                  <span className="btlv-build-best">{best3(x.p, x.pos).join('  ')}</span>
                  <b className="btlv-build-ovr">{x.ovr}</b>
                </button>
              ))}
            </div>
          ))}
        </section>
        <section>
          <h2>{mode === 'koth' ? 'CPUS' : 'CPU'}</h2>
          <div className="btlv-seg">{LEVEL_KEYS.map(l => <button key={l} className={l === level ? 'is-on' : ''} onClick={() => { setLevel(l); sfx('tap') }}>{LEVELS[l].label}</button>)}</div>
        </section>
      </div>
      <footer className="btlv-menu-foot">
        <p className="btlv-rules">{mode === 'koth' ? `EVERY MAN FOR HIMSELF · CLEAR IT AFTER A STOP · FIRST TO ${RULES.goal}, WIN BY ${RULES.winBy}` : `FIRST TO ${RULES.goal} · WIN BY ${RULES.winBy} · ONES AND TWOS`}</p>
        <button className="btlv-play" onClick={() => { sfx('lock'); start() }}>PLAY</button>
      </footer>
    </div>
  )
}

// what the referee needs of a build: the grades
const gradesOf = b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.val]))

// DEV: a seat in a game on a local referee. The referee runs the game; this device moves its own player and times
// its own meter (engine.js, net.js). Two pages on the same room code play each other.
function Online({ cfg, q, mine, pools, mode, name }) {
  const [seat, setSeat] = useState(null)
  const [wait, setWait] = useState(null)
  const [again, setAgain] = useState(null)        // rematch asks so far: { have, need }
  const [line, setLine] = useState('connecting')
  const link = useRef(null)
  useEffect(() => {
    let vid = q.get('btvid')
    if (!vid) { try { vid = sessionStorage.getItem('bap_btlive_vid') || `v${Math.random().toString(36).slice(2, 10)}`; sessionStorage.setItem('bap_btlive_vid', vid) } catch { vid = `v${Math.random().toString(36).slice(2, 10)}` } }
    // the CPUs for the empty seats, if this device is the first one in: real builds near this one
    const r = seeded(`btlv-cpu-${cfg.room}`), used = new Set([mine.p.name])
    const near = pos => { const list = pools[pos].filter(p => !used.has(p.name) && p.photo && Math.abs(ovrOf(p, pos) - mine.ovr) <= 4); const p = (list.length ? list : pools[pos])[Math.floor(r() * (list.length || pools[pos].length))]; used.add(p.name); return { name: p.short || p.name, pos, build: gradesOf(buildFromPlayer(p, keysFor(pos))), look: { photo: p.photo, faceCenter: p.faceCenter } } }
    const cpus = ['guard', 'big', 'guard', 'guard', 'big', 'big'].map(near)
    // (humans, dev only: start before every seat has a person)
    const hello = { vid, name, pos: mine.pos, mode, size: MODES[mode].perTeam, humans: Number(q.get('humans')) || null, build: gradesOf(buildFromPlayer(mine.p, keysFor(mine.pos))), look: { photo: mine.p.photo, faceCenter: mine.p.faceCenter }, cpus }
    const L = { eng: null, queue: [], net: null, attach(eng) { L.eng = eng; for (const m of L.queue.splice(0)) eng.onNet(m) } }
    L.net = openNet({
      server: cfg.server, room: cfg.room, hello, lag: cfg.lag,
      onState: st => { setLine(st); if (st === 'open') L.eng?.resync() },
      onMsg: m => {
        if (m.t === 'pong') return L.net.pong(m)
        if (m.t === 'seat') { setSeat(old => (old && old.seed === m.seed && old.i === m.i ? old : m)); setAgain(null); return }
        if (m.t === 'wait') return setWait(m)
        if (m.t === 'again') return setAgain(m)
        if (m.t === 'gone') return setLine(`gone: ${m.why || ''}`)
        if (L.eng) L.eng.onNet(m); else { L.queue.push(m); if (L.queue.length > 30) L.queue.shift() }
      },
    })
    link.current = L
    if (import.meta.env.DEV) window.__btnet = L.net
    return () => { L.net.close(); if (window.__btnet === L.net) delete window.__btnet }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setup = useMemo(() => {
    if (!seat) return null
    const sm = modeKey(seat.mode ?? seat.size)
    const byTeam = [...Array(MODES[sm].teams).keys()].map(t => seat.seats.map((x, i) => ({ ...x, i })).filter(x => x.team === t))
    const teams = byTeam.map((list, t) => list.map((x, slot) => ({ id: `t${t}p${slot}`, name: x.name, pos: x.pos, build: x.build })))
    const mineTeam = seat.seats[seat.i].team
    const lead = t => byTeam[t].find(x => !x.cpu)?.name ?? byTeam[t][0]?.name ?? 'CPU'
    return {
      online: true, teams, levels: seat.seats.map(() => null), me: seat.i, seed: seat.seed, size: MODES[sm].perTeam, mode: sm,
      looks: seat.seats.map(x => ({ label: x.name, photo: x.look?.photo ?? null, faceCenter: x.look?.faceCenter ?? null })),
      names: byTeam.map((_, t) => (t === mineTeam ? name : lead(t))),
    }
  }, [seat, name])

  if (!setup) {
    return (
      <div className="btlv btlv-menu btlv-wait">
        <header className="btlv-menu-head"><a className="btlv-exit" href="/bucket?btlive=1">EXIT</a><h1>BLACKTOP LIVE</h1><span className="btlv-tag">{cfg.room}</span></header>
        <div className="btlv-wait-body">
          <p className="btlv-wait-big">{line === 'open' ? 'WAITING FOR PLAYERS' : line.toUpperCase()}</p>
          <p className="btlv-wait-n">{MODES[modeKey(wait?.mode ?? mode)].label}</p>
          {wait && <p className="btlv-wait-n">{wait.have} OF {wait.need} IN</p>}
          {line === 'open' && <button className="btlv-ghost" onClick={() => link.current?.net.send({ t: 'start' })}>START WITH CPUS</button>}
        </div>
      </div>
    )
  }
  return <Game key={setup.seed} setup={setup} name={name} link={link.current} again={again} onMenu={() => { window.location.href = '/bucket?btlive=1' }} onRematch={() => { link.current?.net.send({ t: 'again' }); setAgain(a => a ?? { have: 1, need: 0 }) }} />
}

function Game({ setup, name, onMenu, onRematch, link = null, again = null }) {
  const court = useCourt()
  const refs = useRef({})
  const set = k => el => { refs.current[k] = el }
  const [final, setFinal] = useState(null)
  const [ask, setAsk] = useState(false)          // QUIT asks first
  const caps = useMemo(() => !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches, [])
  useEffect(() => {
    const r = refs.current
    const eng = createEngine({
      setup, net: link?.net ?? null,
      els: { canvas: r.canvas, court: r.court, world: r.world, sides: r.sides, clock: r.clock, note: r.note, pad: r.pad, base: r.base, knob: r.knob, home: r.home, btn: { a: r.a, b: r.b, c: r.c }, lab: { a: r.la, b: r.lb, c: r.lc } },
      on: { final: res => setTimeout(() => { setAsk(false); setFinal(res) }, 900) },
    })
    link?.attach(eng)
    if (import.meta.env.DEV) window.__btlive = eng
    // the page doesn't scroll or select under a thumb while a game is up
    document.documentElement.classList.add('btlv-playing')
    return () => { eng.destroy(); document.documentElement.classList.remove('btlv-playing'); if (import.meta.env.DEV && window.__btlive === eng) delete window.__btlive }
  }, [setup])
  // Esc: QUIT's question, and away again
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && !final) setAsk(v => !v) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [final])
  const koth = setup.mode === 'koth' || final?.mode === 'koth' || (final?.score?.length ?? 0) > 2
  const mine = final?.stats?.[setup.me]
  const line = mine ? [['PTS', mine.pts], ['FG', `${mine.fgm}/${mine.fga}`], ['TWOS', `${mine.tpm}/${mine.tpa}`], ['AST', mine.ast], ['REB', mine.reb], ['STL', mine.stl], ['BLK', mine.blk]].filter(([k]) => (setup.size > 1 && !koth) || k !== 'AST') : []
  // King of the Hill's final: each man and his points, the winner first
  const men = final && koth ? setup.looks.map((l, i) => ({ i, label: l.label, pts: final.score?.[i] ?? final.stats?.[i]?.pts ?? 0 })).sort((x, y) => (x.i === final.winner ? -1 : y.i === final.winner ? 1 : y.pts - x.pts)) : null
  const winner = final ? (koth ? setup.looks[final.winner]?.label : setup.names[final.winner]) : ''
  return (
    <div className={`btlv btlv-game${caps ? ' has-keys' : ''}`}>
      <div className="btlv-bug">
        <button className="btlv-quit" onClick={() => { sfx('tap'); setAsk(true) }} aria-label="Leave the game">QUIT</button>
        <div className="btlv-bug-sides" ref={set('sides')} />
        <div className="btlv-bug-clock"><small>SHOT CLOCK</small><b ref={set('clock')} /></div>
        <p className="btlv-bug-note"><span ref={set('note')} /><span className="btlv-bug-goal">FIRST TO {RULES.goal} · WIN BY {RULES.winBy}</span></p>
      </div>
      <div className="btlv-stage">
        <div className="btlv-court" ref={set('court')}>
          <div className="btlv-world" ref={set('world')}><img src={court.src} alt="" draggable={false} /></div>
          <canvas ref={set('canvas')} />
        </div>
      </div>
      <div className="btlv-pad" ref={set('pad')}>
        <i className="btlv-stick-home" ref={set('home')} />
        <i className="btlv-stick-base" ref={set('base')} /><i className="btlv-stick-knob" ref={set('knob')} />
        {caps && <div className="btlv-keys"><b>MOVE</b><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><small>OR THE ARROWS</small></div>}
        <div className="btlv-btns">
          <button className="btlv-btn btlv-btn-a" ref={set('a')}>{caps && <kbd>J</kbd>}<span ref={set('la')} /></button>
          <button className="btlv-btn btlv-btn-b" ref={set('b')}>{caps && <kbd>K</kbd>}<span ref={set('lb')} /></button>
          <button className="btlv-btn btlv-btn-c" ref={set('c')}>{caps && <kbd>L</kbd>}<span ref={set('lc')} /></button>
        </div>
      </div>
      {ask && !final && (
        <div className="btlv-confirm" role="dialog" aria-label="Leave the game" onClick={e => { if (e.target === e.currentTarget) setAsk(false) }}>
          <div className="btlv-confirm-card">
            <p className="btlv-confirm-q">LEAVE THE GAME?</p>
            {setup.online && <p className="btlv-confirm-sub">IT COUNTS AS A LOSS</p>}
            <div className="btlv-final-btns">
              <button className="btlv-play" onClick={() => { sfx('tap'); setAsk(false) }}>KEEP PLAYING</button>
              <button className="btlv-ghost btlv-leave" onClick={() => { sfx('back'); onMenu() }}>LEAVE</button>
            </div>
          </div>
        </div>
      )}
      {final && (
        <div className="btlv-final" role="dialog" aria-label="Final">
          <div className="btlv-final-card">
            <span className="btlv-tag">FINAL</span>
            {men ? (
              <div className="btlv-final-men">{men.map(x => <div key={x.i} className={x.i === final.winner ? 'is-win' : ''}><span>{x.label}</span><b>{x.pts}</b></div>)}</div>
            ) : (
              <div className="btlv-final-score"><b className="btlv-t0">{final.score[0]}</b><i>-</i><b className="btlv-t1">{final.score[1]}</b></div>
            )}
            <p className="btlv-final-who">{winner} WINS</p>
            <div className="btlv-final-line"><span className="btlv-final-name">{name}</span>{line.map(([k, v]) => <span key={k}><b>{v}</b><small>{k}</small></span>)}</div>
            <div className="btlv-final-btns">
              <button className="btlv-play" disabled={!!again} onClick={() => { sfx('lock'); onRematch() }}>{again ? (again.need ? `WAITING · ${again.have} OF ${again.need}` : 'WAITING') : 'REMATCH'}</button>
              <button className="btlv-ghost" onClick={() => { sfx('back'); onMenu() }}>MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
