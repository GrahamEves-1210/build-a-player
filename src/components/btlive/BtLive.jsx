// DEV ONLY (BucketApp mounts it behind import.meta.env.DEV and lib/btLive.js, so it never ships): BLACKTOP LIVE,
// the real-time prototype of Blacktop. Practice against the CPU, on this device: nothing here touches the live
// server, an account, a record or today's Blacktop.
//   /bucket?btlive=1                      the practice menu
//   &size=1|2|3  &level=rookie|pro|allstar|legend  &pick=<player name>  &seed=abc  &go=1 (straight into a game)
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
import { GUARD_KEYS, BIG_KEYS, LEVELS, RULES } from '../../lib/btlive/index.js'
import { createEngine } from './engine'
import './btlive.css'

// the practice builds: real players' ratings, a spread of games to try (a shooter, a slasher, a stopper, bigs)
const PRESETS = [
  ['guard', 'Stephen Curry'], ['guard', 'Shai Gilgeous-Alexander'], ['guard', 'Anthony Edwards'], ['guard', 'Dyson Daniels'],
  ['big', 'Nikola Jokic'], ['big', 'Victor Wembanyama'], ['big', 'Giannis Antetokounmpo'], ['big', 'Rudy Gobert'],
]
const SIZES = [1, 2, 3]
const LEVEL_KEYS = Object.keys(LEVELS)
const KEEP = 'bap_btlive_practice'
const keysFor = pos => (pos === 'big' ? BIG_KEYS : GUARD_KEYS)
const ovrOf = (p, pos) => calcBucketOVR(buildFromPlayer(p, keysFor(pos)), keysFor(pos), pos)
// his three best ratings, as the build screens name them
const best3 = (p, pos) => keysFor(pos).map(k => [k, p.attrs?.[k] ?? 0]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${BUCKET_ATTR[k]?.shortLabel ?? k} ${v}`)

function Face({ p, size = 38 }) {
  const fc = p.faceCenter
  return <span className="btl-face" style={{ width: size, height: size }}>{p.photo && <img src={p.photo} alt="" draggable={false} style={fc ? { objectPosition: `${fc[0]}% ${fc[1]}%` } : undefined} />}</span>
}

export default function BtLive({ pools, user }) {
  const q = useMemo(() => new URLSearchParams(window.location.search), [])
  const name = getUsername(user) || 'Guest'
  const presets = useMemo(() => PRESETS.map(([pos, n]) => { const p = pools[pos]?.find(x => x.name === n); return p ? { pos, p, ovr: ovrOf(p, pos) } : null }).filter(Boolean), [pools])
  const kept = useMemo(() => { try { return JSON.parse(localStorage.getItem(KEEP) || '{}') } catch { return {} } }, [])
  const [size, setSize] = useState(() => { const v = Number(q.get('size')) || kept.size; return SIZES.includes(v) ? v : 1 })
  const [level, setLevel] = useState(() => { const v = q.get('level') || kept.level; return LEVEL_KEYS.includes(v) ? v : 'pro' })
  const [pick, setPick] = useState(() => { const v = q.get('pick') || kept.pick; return presets.some(x => x.p.name === v) ? v : presets[0]?.p.name })
  const [game, setGame] = useState(null)          // { key, setup }: a game in progress
  useEffect(() => { try { localStorage.setItem(KEEP, JSON.stringify({ size, level, pick })) } catch {} }, [size, level, pick])

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
    const sideA = [mine, ...(size >= 2 ? [near(other)] : []), ...(size >= 3 ? [near('guard')] : [])]
    const sideB = size === 1 ? [near(mine.pos)] : size === 2 ? [near('guard'), near('big')] : [near('guard'), near('guard'), near('big')]
    const mk = (x, t, i) => ({ id: `t${t}p${i}`, name: x.p.short || x.p.name, pos: x.pos, build: buildFromPlayer(x.p, keysFor(x.pos)) })
    const all = [...sideA, ...sideB]
    setGame({
      key: sd + Math.random(),
      setup: {
        teams: [sideA.map((x, i) => mk(x, 0, i)), sideB.map((x, i) => mk(x, 1, i))],
        levels: all.map((_, i) => (i === 0 ? null : level)),
        me: 0, seed: sd, size, level,
        looks: all.map((x, i) => ({ label: i === 0 ? name : (x.p.short || x.p.name), photo: x.p.photo, faceCenter: x.p.faceCenter })),
        names: [size === 1 ? name : `${name}'s team`, `CPU ${LEVELS[level].label}`],
      },
    })
  }
  useEffect(() => { if (q.get('go') && presets.length) start() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (game) return <Game key={game.key} setup={game.setup} name={name} onMenu={() => setGame(null)} onRematch={() => start(`r${Date.now().toString(36)}`)} />

  const groups = [['GUARDS', presets.filter(x => x.pos === 'guard')], ['BIGS', presets.filter(x => x.pos === 'big')]]
  return (
    <div className="btl btl-menu">
      <header className="btl-menu-head">
        <a className="btl-exit" href="/bucket">EXIT</a>
        <h1>BLACKTOP LIVE</h1>
        <span className="btl-tag">PRACTICE</span>
      </header>
      <div className="btl-menu-body">
        <section>
          <h2>GAME</h2>
          <div className="btl-seg">{SIZES.map(n => <button key={n} className={n === size ? 'is-on' : ''} onClick={() => { setSize(n); sfx('tap') }}>{n}V{n}</button>)}</div>
        </section>
        <section>
          <h2>BUILD</h2>
          {groups.map(([label, list]) => (
            <div key={label} className="btl-builds">
              <h3>{label}</h3>
              {list.map(x => (
                <button key={x.p.name} className={`btl-build${x.p.name === pick ? ' is-on' : ''}`} onClick={() => { setPick(x.p.name); sfx('tap') }}>
                  <Face p={x.p} />
                  <span className="btl-build-name">{x.p.name}</span>
                  <span className="btl-build-best">{best3(x.p, x.pos).join('  ')}</span>
                  <b className="btl-build-ovr">{x.ovr}</b>
                </button>
              ))}
            </div>
          ))}
        </section>
        <section>
          <h2>CPU</h2>
          <div className="btl-seg">{LEVEL_KEYS.map(l => <button key={l} className={l === level ? 'is-on' : ''} onClick={() => { setLevel(l); sfx('tap') }}>{LEVELS[l].label}</button>)}</div>
        </section>
      </div>
      <footer className="btl-menu-foot">
        <p className="btl-rules">FIRST TO {RULES.goal} · WIN BY {RULES.winBy} · ONES AND TWOS</p>
        <button className="btl-play" onClick={() => { sfx('lock'); start() }}>PLAY</button>
      </footer>
    </div>
  )
}

function Game({ setup, name, onMenu, onRematch }) {
  const court = useCourt()
  const refs = useRef({})
  const set = k => el => { refs.current[k] = el }
  const [final, setFinal] = useState(null)
  const caps = useMemo(() => !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches, [])
  useEffect(() => {
    const r = refs.current
    const eng = createEngine({
      setup,
      els: { canvas: r.canvas, court: r.court, clock: r.clock, score: [r.s0, r.s1], poss: [r.p0, r.p1], pad: r.pad, base: r.base, knob: r.knob, btn: { a: r.a, b: r.b, c: r.c }, lab: { a: r.la, b: r.lb, c: r.lc } },
      on: { final: res => setTimeout(() => setFinal(res), 900) },
    })
    if (import.meta.env.DEV) window.__btlive = eng
    // the page doesn't scroll or select under a thumb while a game is up
    document.documentElement.classList.add('btl-playing')
    return () => { eng.destroy(); document.documentElement.classList.remove('btl-playing'); if (import.meta.env.DEV && window.__btlive === eng) delete window.__btlive }
  }, [setup])
  const mine = final?.stats[setup.me]
  const line = mine ? [['PTS', mine.pts], ['FG', `${mine.fgm}/${mine.fga}`], ['TWOS', `${mine.tpm}/${mine.tpa}`], ['AST', mine.ast], ['REB', mine.reb], ['STL', mine.stl], ['BLK', mine.blk]].filter(([k]) => setup.size > 1 || k !== 'AST') : []
  return (
    <div className={`btl btl-game${caps ? ' has-keys' : ''}`}>
      <div className="btl-bug">
        <button className="btl-quit" onClick={onMenu} aria-label="Leave the game">QUIT</button>
        <div className="btl-bug-team btl-t0"><i ref={set('p0')} className="btl-bug-poss" /><span className="btl-bug-name">{setup.names[0]}</span><b ref={set('s0')} className="btl-bug-score">0</b></div>
        <div className="btl-bug-mid"><b ref={set('clock')} className="btl-bug-clock" /><small>TO {RULES.goal}</small></div>
        <div className="btl-bug-team btl-t1"><b ref={set('s1')} className="btl-bug-score">0</b><span className="btl-bug-name">{setup.names[1]}</span><i ref={set('p1')} className="btl-bug-poss" /></div>
      </div>
      <div className="btl-stage">
        <div className="btl-court" ref={set('court')}>
          <img src={court.src} alt="" draggable={false} />
          <canvas ref={set('canvas')} />
        </div>
      </div>
      <div className="btl-pad" ref={set('pad')}>
        <i className="btl-stick-base" ref={set('base')} /><i className="btl-stick-knob" ref={set('knob')} />
        <div className="btl-btns">
          <button className="btl-btn btl-btn-a" ref={set('a')}><span ref={set('la')} />{caps && <kbd>J</kbd>}</button>
          <button className="btl-btn btl-btn-b" ref={set('b')}><span ref={set('lb')} />{caps && <kbd>K</kbd>}</button>
          <button className="btl-btn btl-btn-c" ref={set('c')}><span ref={set('lc')} />{caps && <kbd>L</kbd>}</button>
        </div>
        {caps && <p className="btl-keys">WASD OR ARROWS TO MOVE</p>}
      </div>
      {final && (
        <div className="btl-final" role="dialog" aria-label="Final">
          <div className="btl-final-card">
            <span className="btl-tag">FINAL</span>
            <div className="btl-final-score"><b className="btl-t0">{final.score[0]}</b><i>-</i><b className="btl-t1">{final.score[1]}</b></div>
            <p className="btl-final-who">{setup.names[final.winner]} WINS</p>
            <div className="btl-final-line"><span className="btl-final-name">{name}</span>{line.map(([k, v]) => <span key={k}><b>{v}</b><small>{k}</small></span>)}</div>
            <div className="btl-final-btns">
              <button className="btl-play" onClick={() => { sfx('lock'); onRematch() }}>REMATCH</button>
              <button className="btl-ghost" onClick={() => { sfx('back'); onMenu() }}>MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
