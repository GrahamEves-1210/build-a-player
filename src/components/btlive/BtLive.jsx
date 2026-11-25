// DEV ONLY (BucketApp mounts it behind import.meta.env.DEV and lib/btLive.js, so it never ships): BLACKTOP LIVE,
// the real-time prototype of Blacktop. Practice against the CPU, on this device: nothing here touches the live
// server, an account, a record or today's Blacktop.
//   /bucket?btlive=1                      the practice menu
//   &mode=1v1|2v2|koth (King of the Hill)  &level=rookie|pro|allstar|legend  &pick=<player name>  &seed=abc
//   &go=1 (straight into a game). An old &size=1|2 still works; &size=3 (3v3, gone) opens 1v1
// Controls: the left stick (WASD) moves. With the ball it makes NBA 2K's pro stick moves too, only on purpose (a snap,
// a pump or a half circle of it: lib/btlive/gesture.js; a WASD key tapped twice, SHIFT the spin), SHOOT (SPACE: hold,
// let go on the meter), PASS (E). CONTROLS can put the moves back on a second stick (the right pad, the arrow keys):
// &stick=one|two. On defense: the right pad is STEAL (E), SHOOT is BLOCK (SPACE: a hand up, the only jump). Off the
// ball: SHOOT is REBOUND with the ball up, PASS is CALL FOR IT
// The game itself is lib/btlive (pure code); engine.js runs and draws it. On the dev server the running game is
// on window.__btlive (state, pause, run, auto, press, stick, flick, wait) for screenshots and tests.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { adsOffHere } from '../../lib/ads'
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
// where the dribble moves are: 'one' on the move stick (the default), 'two' on a second stick (CONTROLS)
const STICK = 'bap_btlive_stick'
const readStick = () => { try { return localStorage.getItem(STICK) === 'two' ? 'two' : 'one' } catch { return 'one' } }
const keysFor = pos => (pos === 'big' ? BIG_KEYS : GUARD_KEYS)
const ovrOf = (p, pos) => calcBucketOVR(buildFromPlayer(p, keysFor(pos)), keysFor(pos), pos)
// his three best ratings, as the build screens name them
const best3 = (p, pos) => keysFor(pos).map(k => [k, p.attrs?.[k] ?? 0]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${BUCKET_ATTR[k]?.shortLabel ?? k} ${v}`)

// the arrow keys (up, left, right, down)
const ARROWS = ['\u2191', '\u2190', '\u2192', '\u2193']
// ...and on the move stick the same four ways are W A D S, tapped twice
const WASD1 = ['W', 'A', 'D', 'S']
// a key as it looks on a keyboard; WASD as the keys sit (W over A S D)
const Key = ({ children, wide = false }) => <kbd className={`btlv-key${wide ? ' is-wide' : ''}`}>{children}</kbd>
const Wasd = () => <span className="btlv-wasd"><Key>W</Key><span><Key>A</Key><Key>S</Key><Key>D</Key></span></span>

function Face({ p, size = 38 }) {
  const fc = p.faceCenter
  return <span className="btlv-face" style={{ width: size, height: size }}>{p.photo && <img src={p.photo} alt="" draggable={false} style={fc ? { objectPosition: `${fc[0]}% ${fc[1]}%` } : undefined} />}</span>
}

// a phone (a touch screen, or a narrow window): no ads anywhere on Blacktop Live, the menu or a game. On a computer the
// bottom rail stays, and every layout here keeps clear of it (--rail)
const phone = () => !!window.matchMedia?.('(pointer: coarse), (max-width: 899px)').matches

export default function BtLive({ pools, user }) {
  const q = useMemo(() => new URLSearchParams(window.location.search), [])
  // (a layout effect: it runs before the page's own ad call, so on a phone no unit is even asked for)
  useLayoutEffect(() => (phone() ? adsOffHere() : undefined), [])
  const name = getUsername(user) || 'Guest'
  const presets = useMemo(() => PRESETS.map(([pos, n]) => { const p = pools[pos]?.find(x => x.name === n); return p ? { pos, p, ovr: ovrOf(p, pos) } : null }).filter(Boolean), [pools])
  const kept = useMemo(() => { try { return JSON.parse(localStorage.getItem(KEEP) || '{}') } catch { return {} } }, [])
  const [mode, setMode] = useState(() => modeKey(q.get('mode') || q.get('size') || kept.mode || kept.size))
  const size = MODES[mode].perTeam
  const [level, setLevel] = useState(() => { const v = q.get('level') || kept.level; return LEVEL_KEYS.includes(v) ? v : 'pro' })
  const [pick, setPick] = useState(() => { const v = q.get('pick') || kept.pick; return presets.some(x => x.p.name === v) ? v : presets[0]?.p.name })
  const [game, setGame] = useState(null)          // { key, setup }: a game in progress
  const [view, setView] = useState(() => (q.get('view') === 'controls' ? 'controls' : 'menu'))   // the menu, or CONTROLS
  const [stick, setStick] = useState(() => (['one', 'two'].includes(q.get('stick')) ? q.get('stick') : readStick()))
  const pickStick = v => { setStick(v); try { localStorage.setItem(STICK, v) } catch {} }
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
        me: 0, seed: sd, size: MODES[mode].perTeam, mode, level, stick,
        // (who, skin, num: the real player the build is from, his skin tone and number: how his man is drawn on the court)
        looks: all.map((x, i) => ({ label: i === 0 ? name : (x.p.short || x.p.name), photo: x.p.photo, faceCenter: x.p.faceCenter, who: x.p.name, skin: x.p.skin ?? null, num: x.p.number ?? null })),
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
    return <Online cfg={netCfg} q={q} mine={mine} pools={pools} mode={mode} name={name} stick={stick} />
  }

  if (game) return <Game key={game.key} setup={game.setup} name={name} onMenu={() => setGame(null)} onRematch={rematch} />

  if (view === 'controls') return <Controls stick={stick} setStick={pickStick} onBack={() => { sfx('back'); setView('menu') }} />

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
        <section className="btlv-menu-ctl">
          <button className="btlv-row" onClick={() => { sfx('tap'); setView('controls') }}><span>CONTROLS</span><small>MOVES, DEFENSE, THE RULES</small><i aria-hidden="true" /></button>
        </section>
      </div>
      <footer className="btlv-menu-foot">
        <p className="btlv-rules">{mode === 'koth' ? `TWO PLAY, ONE SITS · SCORE AND STAY · FIRST TO ${RULES.goal}, WIN BY ${RULES.winBy}` : `FIRST TO ${RULES.goal} · WIN BY ${RULES.winBy} · ONES AND TWOS`}</p>
        <button className="btlv-play" onClick={() => { sfx('lock'); start() }}>PLAY</button>
      </footer>
    </div>
  )
}

// ── CONTROLS: every control, for a phone and a keyboard, in the same look as the game's own ─────────────────
// The moves are read from the basket (forward) and the hand the ball is in (referee.moveOf); drawn here with the ball
// in his right hand and the basket at the top: the way the right pad names them in a game at the top of the key
const DIAL = [['HESI', 'HESITATION', 'Stop, start, go at the basket'], ['IN & OUT', 'IN AND OUT', 'Fake the crossover, keep it in the same hand'], ['IN & OUT', '', ''],
  ['STEP-BACK', '', ''], ['STEP-BACK', 'STEP-BACK', 'A hop back off him: room for the jumper'], ['BEHIND BACK', 'BEHIND THE BACK', 'To the other hand, round behind, away from his reach'],
  ['BETWEEN LEGS', 'BETWEEN THE LEGS', 'To the other hand through the legs, a hard cut sideways'], ['CROSS', 'CROSSOVER', 'To the other hand, across in front, and go']]
const DIAL_SHOW = [0, 2, 4, 5, 6, 7]
function Dial({ keys = false, wasd = false }) {
  // (a keyboard has no corner keys: a corner is two together. On the move stick: the first held, the second tapped twice)
  const arrow = wasd ? [['W'], ['W', 'D'], ['D'], ['S', 'D'], ['S'], ['S', 'A'], ['A'], ['W', 'A']] : [['↑'], ['↑', '→'], ['→'], ['↓', '→'], ['↓'], ['↓', '←'], ['←'], ['↑', '←']]
  return (
    <div className="btlv-dial" aria-label="Dribble moves, the ball in his right hand">
      <span className="btlv-dial-rim">BASKET</span>
      <div className="btlv-dial-pad">
        {DIAL_SHOW.map(i => <span key={i} className={`btlv-dial-w is-${i}`}>{keys && <span className="btlv-kk">{arrow[i].map(k => <Key key={k}>{k}</Key>)}</span>}{DIAL[i][0]}</span>)}
        <i className="btlv-dial-man" /><i className="btlv-dial-ball" />
      </div>
      <span className="btlv-dial-cap">THE BALL IN THE RIGHT HAND{wasd && <><br />HOLD THE FIRST KEY, TAP THE LAST ONE TWICE</>}</span>
    </div>
  )
}
// The move stick's gestures, drawn on the stick: where the thumb holds (the dot), the quick part (the arrow)
// (in a 100 x 100 box; the stick's ring is r 40 round the middle)
const GEST_PATH = {
  snap: { hold: [10, 50], d: 'M10 50 L44 16', head: [48, 12, -45] },
  across: { hold: [90, 50], d: 'M90 50 L17 50', head: [12, 50, 180] },
  pump: { hold: [50, 10], d: 'M41 16 L41 50 M59 50 L59 17', head: [59, 11, -90], tail: [41, 56, 90] },
  spin: { hold: [10, 50], d: 'M10 50 A40 40 0 0 1 90 50', head: [90, 57, 90] },
}
function Gest({ k }) {
  const g = GEST_PATH[k]
  const tip = ([x, y, a]) => <path d="M0 0 L-9 -5.5 L-9 5.5 Z" transform={`translate(${x} ${y}) rotate(${a})`} />
  return (
    <svg className="btlv-gest" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="40" className="btlv-gest-ring" />
      <circle cx="50" cy="50" r="3" className="btlv-gest-mid" />
      <path d={g.d} className="btlv-gest-line" />
      <g className="btlv-gest-tip">{tip(g.head)}{g.tail && tip(g.tail)}</g>
      <circle cx={g.hold[0]} cy={g.hold[1]} r="7" className="btlv-gest-hold" />
    </svg>
  )
}
function Controls({ onBack, stick, setStick }) {
  const fine = !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
  const [dev, setDev] = useState(fine ? 'keys' : 'phone')
  const [side, setSide] = useState('off')
  const K = dev === 'keys', O = side === 'off', ONE = stick !== 'two'
  const Row = ({ c, t, d }) => <div className="btlv-ctl-row"><span className="btlv-ctl-c">{c}</span><span className="btlv-ctl-t"><b>{t}</b>{d && <small>{d}</small>}</span></div>
  const pill = t => <span className="btlv-ctl-pill">{t}</span>
  const arrows = <span className="btlv-kk is-arrows">{ARROWS.map(a => <Key key={a}>{a}</Key>)}</span>
  const wasd2 = <span className="btlv-kk">{['W', 'A', 'S', 'D'].map(a => <Key key={a}>{a}</Key>)}</span>
  return (
    <div className="btlv btlv-menu btlv-ctl">
      <header className="btlv-menu-head">
        <button className="btlv-exit" onClick={onBack}>BACK</button>
        <h1>CONTROLS</h1>
        <span />
      </header>
      <div className="btlv-menu-body">
        <div className="btlv-seg btlv-ctl-seg">{[['phone', 'PHONE'], ['keys', 'KEYBOARD']].map(([k, l]) => <button key={k} className={dev === k ? 'is-on' : ''} onClick={() => { setDev(k); sfx('tap') }}>{l}</button>)}</div>
        <div className="btlv-seg btlv-ctl-seg is-side">{[['off', 'WITH THE BALL'], ['def', 'ON DEFENSE']].map(([k, l]) => <button key={k} className={side === k ? 'is-on' : ''} onClick={() => { setSide(k); sfx('tap') }}>{l}</button>)}</div>
        <section className="btlv-ctl-set">
          <h2>DRIBBLE MOVES</h2>
          <div className="btlv-seg">{[['one', 'ON THE MOVE STICK'], ['two', 'ON A SECOND STICK']].map(([k, l]) => <button key={k} className={stick === k ? 'is-on' : ''} onClick={() => { setStick(k); sfx('tap') }}>{l}</button>)}</div>
        </section>
        {!K && (
          <figure className={`btlv-demo${O ? '' : ' is-def'}${O && ONE ? ' is-one' : ''}`} aria-label={O ? 'The controls with the ball' : 'The controls on defense'}>
            <div className="btlv-demo-stick"><i /><span>{O && ONE ? 'MOVE + MOVES' : 'MOVE'}</span></div>
            {O ? (!ONE && <div className="btlv-demo-pad"><i /><span>MOVES</span></div>) : <div className="btlv-demo-pad is-steal"><b>STEAL</b></div>}
            {O ? <div className="btlv-demo-a"><b>SHOOT</b><small>HOLD, LET GO</small></div> : <div className="btlv-demo-a is-def"><b>BLOCK</b><small>HAND UP</small></div>}
            {O && <div className="btlv-demo-b">PASS</div>}
            <figcaption>{O ? 'WITH THE BALL' : 'ON DEFENSE'}</figcaption>
          </figure>
        )}
        {O ? (
          <>
            <section>
              <h2>WITH THE BALL</h2>
              <Row c={K ? <Wasd /> : pill('LEFT STICK')} t="MOVE" d={K ? 'Two keys together for the diagonals' : `Drag anywhere on the left side${ONE ? '. Steering, curving and stopping never make a move' : ''}`} />
              <Row c={K ? <Key wide>SPACE</Key> : pill('SHOOT')} t="SHOOT" d="Hold it, let go when the meter is in the green. Close in it's a layup or a dunk; with the lane open a good leaper takes off from farther out" />
              <Row c={K ? <Key>E</Key> : pill('PASS')} t="PASS (2V2)" d="To the teammate the stick points at, or the open man" />
              {ONE
                ? <Row c={K ? wasd2 : pill('LEFT STICK')} t="DRIBBLE MOVES" d={K ? 'Tap a key twice. Hold the way you\'re going with it: W held and A tapped twice is up and left' : 'The move stick makes the moves too, only on purpose: hold it one way, then one of the four below, quickly'} />
                : <Row c={K ? arrows : pill('RIGHT STICK')} t="DRIBBLE MOVES" d={K ? 'Tap an arrow toward a move. Two arrows together make the moves in between' : 'Flick the right stick toward a move'} />}
            </section>
            {ONE && !K && (
              <section className="btlv-ctl-gest">
                <h2>THE MOVE STICK</h2>
                <p className="btlv-ctl-p">Hold the stick one way for a beat, then:</p>
                <Row c={<Gest k="snap" />} t="SNAP IT" d="Hard over to a new way, a quarter turn or more (or a quick flick to the diagonal): the move that way" />
                <Row c={<Gest k="across" />} t="STRAIGHT ACROSS" d="Through the middle to the other side: the move that way. Away from the basket it's the step-back" />
                <Row c={<Gest k="pump" />} t="PUMP IT" d="Back to the middle and straight out again: the move that way. At the basket it's the hesitation" />
                <Row c={<Gest k="spin" />} t="HALF CIRCLE" d="Round the outside, half a turn: the spin, coming out the way the stick ends up" />
              </section>
            )}
            <section className="btlv-ctl-moves">
              <h2>THE MOVES</h2>
              <p className="btlv-ctl-p">Every move is read from the basket and the hand the ball is in, by the way {ONE ? (K ? 'the keys point' : 'the stick ends up') : 'the flick points'}. Here the ball is in the right hand; in the left hand every move flips sides. {K ? 'The panel beside the court names each key\'s move from where he stands.' : 'There are no names on the stick in a game: learn them here.'}</p>
              <Dial keys={K} wasd={K && ONE} />
              {DIAL.filter(d => d[1]).map(d => <Row key={d[1]} c={<span className="btlv-ctl-mv">{d[0]}</span>} t={d[1]} d={d[2]} />)}
              <Row c={K && ONE ? <Key wide>SHIFT</Key> : <span className="btlv-ctl-mv">SPIN</span>} t="SPIN MOVE" d={ONE ? (K ? 'Round his man, coming out the way WASD points (at the basket with no key held)' : 'The half circle on the move stick') : (K ? 'An arrow, then quickly one a quarter turn round from it' : 'Flick, then roll round a quarter turn while the move is on')} />
              <Row c={<span className="btlv-ctl-stam"><i /></span>} t="DRIBBLE LEGS" d="Every move costs some legs, a move chained straight off another more. The arc under the man with the ball shows them while they're not full. Tired legs: a shorter, slower move that freezes nobody and is easier to strip. Simple dribbling and the time off the ball bring them back" />
              <Row c={<span className="btlv-ctl-mv">OUT OF IT</span>} t="THE FIRST STEP" d="Out of a hesitation, a crossover, between the legs or an in-and-out he's a beat quicker. Pulling up on the move costs a little off the jumper; a step-back lands him set" />
            </section>
            <section>
              <h2>OFF THE BALL</h2>
              <Row c={K ? <Key wide>SPACE</Key> : pill('SHOOT')} t="REBOUND" d="With a shot or a loose ball up, it's the jump for the board. With a teammate on the ball, a press shoots on the catch" />
              <Row c={K ? <Key>E</Key> : pill('PASS')} t="CALL FOR IT (2V2)" d="Ask for the pass" />
            </section>
          </>
        ) : (
          <section>
            <h2>ON DEFENSE</h2>
            <Row c={K ? <Wasd /> : pill('LEFT STICK')} t="MOVE" d="Square to the man: going at him is quickest, sliding is a touch slower, giving ground backwards slower still" />
            <Row c={K ? <Key wide>SPACE</Key> : pill('BLOCK')} t="BLOCK" d="A hand up at the shot: the only way to leave the floor on defense. Time it to the release, square in front of him, and a big gets plenty of them. A hand up, even late, takes a lot off the shot; no hand is an open look" />
            <Row c={K ? <Key>E</Key> : pill('STEAL')} t="STEAL" d={K ? 'A swipe at the ball. A miss leaves the defender stuck for a beat' : 'The circle on the right is the STEAL button. A miss leaves the defender stuck for a beat'} />
            <Row c={K ? <Key wide>SPACE</Key> : pill('REBOUND')} t="REBOUND" d="With the shot up, BLOCK turns into REBOUND: the jump for the board" />
          </section>
        )}
        <section>
          <h2>THE RULES</h2>
          <ul className="btlv-ctl-rules">
            <li><b>CHECK BALL</b> at the top to start and after every basket. Make it, take it: score and keep the ball.</li>
            <li><b>TAKE IT BACK</b> (1V1, 2V2) after a defensive rebound, a steal or a block. No check: the ball is live, but it has to go back behind the arc first (the arc lights up). A basket before that is waved off and it's the other side's ball.</li>
            <li><b>OFFENSIVE REBOUND:</b> no need to take it back.</li>
            <li><b>KING OF THE HILL:</b> three players, two on the floor and one sitting out at the side. Score and you're still king: the man you scored on sits and the one waiting checks in to guard you. Get a stop and the crown is yours: the old king sits. Every change is checked at the top. Everyone keeps his own score.</li>
            <li><b>FIRST TO {RULES.goal}</b>, win by {RULES.winBy}. Ones inside the arc, twos behind it.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

// what the referee needs of a build: the grades
const gradesOf = b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.val]))

// DEV: a seat in a game on a local referee. The referee runs the game; this device moves its own player and times
// its own meter (engine.js, net.js). Two pages on the same room code play each other.
function Online({ cfg, q, mine, pools, mode, name, stick }) {
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
    const near = pos => { const list = pools[pos].filter(p => !used.has(p.name) && p.photo && Math.abs(ovrOf(p, pos) - mine.ovr) <= 4); const p = (list.length ? list : pools[pos])[Math.floor(r() * (list.length || pools[pos].length))]; used.add(p.name); return { name: p.short || p.name, pos, build: gradesOf(buildFromPlayer(p, keysFor(pos))), look: { photo: p.photo, faceCenter: p.faceCenter, skin: p.skin ?? null, num: p.number ?? null } } }
    const cpus = ['guard', 'big', 'guard', 'guard', 'big', 'big'].map(near)
    // (humans, dev only: start before every seat has a person)
    const hello = { vid, name, pos: mine.pos, mode, size: MODES[mode].perTeam, humans: Number(q.get('humans')) || null, build: gradesOf(buildFromPlayer(mine.p, keysFor(mine.pos))), look: { photo: mine.p.photo, faceCenter: mine.p.faceCenter, skin: mine.p.skin ?? null, num: mine.p.number ?? null }, cpus }
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
      online: true, teams, levels: seat.seats.map(() => null), me: seat.i, seed: seat.seed, size: MODES[sm].perTeam, mode: sm, stick,
      looks: seat.seats.map(x => ({ label: x.name, photo: x.look?.photo ?? null, faceCenter: x.look?.faceCenter ?? null, who: x.look?.photo || x.name, skin: x.look?.skin ?? null, num: x.look?.num ?? null })),
      names: byTeam.map((_, t) => (t === mineTeam ? name : lead(t))),
    }
  }, [seat, name, stick])

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
      els: { root: r.root, canvas: r.canvas, court: r.court, world: r.world, sides: r.sides, clock: r.clock, note: r.note, pad: r.pad, base: r.base, knob: r.knob, home: r.home, ds: r.ds, dk: r.dk,
        steal: r.stl, btn: { a: r.a, b: r.b }, lab: { a: r.la, b: r.lb, sa: r.sa },
        keys: { pass: r.kpass, passRow: r.kpassRow, shoot: r.kshoot, shootRow: r.kshootRow, shootSub: r.ksub, title: r.ktitle, box: r.kbox, stealRow: r.kstealRow, spinRow: r.kspinRow,
          arrows: ARROWS.map((_, i) => r[`ka${i}`]), subs: ARROWS.map((_, i) => r[`ks${i}`]), rows: ARROWS.map((_, i) => r[`kr${i}`]) } },
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
    <div className={`btlv btlv-game${caps ? ' has-keys' : ''}${setup.size > 1 && !koth ? ' is-team' : ''}`} ref={set('root')}>
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
        <i className="btlv-stick-base" ref={set('base')} data-l="MOVE" /><i className="btlv-stick-knob" ref={set('knob')} />
        {/* a keyboard: the keys in one column on the left of the court (the bottom ad rail is under it, never on it);
            only what does something right now shows, for the side of the ball he's on (engine.js hud) */}
        {caps && (
          <div className="btlv-keys-col">
            <div className="btlv-keys is-l" aria-label="Keys">
              <div className="btlv-keys-row"><Wasd /><span className="btlv-kt"><b>MOVE</b></span></div>
              <div className="btlv-keys-row is-shoot" ref={set('kshootRow')}><span className="btlv-kk"><Key wide>SPACE</Key></span><span className="btlv-kt"><b ref={set('kshoot')}>SHOOT</b><small ref={set('ksub')} /></span></div>
              {setup.size > 1 && !koth && <div className="btlv-keys-row is-pass" ref={set('kpassRow')}><span className="btlv-kk"><Key>E</Key></span><span className="btlv-kt"><b ref={set('kpass')}>PASS</b></span></div>}
            </div>
            <div className="btlv-keys is-r" aria-label="Dribble moves and steal" ref={set('kbox')}>
              <p className="btlv-keys-title" ref={set('ktitle')} />
              {(setup.stick === 'two' ? ARROWS : WASD1).map((a, i) => <div key={a} className="btlv-keys-row" ref={set(`kr${i}`)}><span className="btlv-kk"><Key>{a}</Key></span><span className="btlv-kt"><b ref={set(`ka${i}`)} /><small ref={set(`ks${i}`)} /></span></div>)}
              <div className="btlv-keys-row is-off" ref={set('kspinRow')}><span className="btlv-kk"><Key wide>SHIFT</Key></span><span className="btlv-kt"><b>SPIN</b></span></div>
              <div className="btlv-keys-row is-steal is-off" ref={set('kstealRow')}><span className="btlv-kk"><Key>E</Key></span><span className="btlv-kt"><b>STEAL</b><small>A SWIPE AT THE BALL</small></span></div>
            </div>
          </div>
        )}
        <div className="btlv-btns">
          {/* the right pad: on defense the STEAL button; with the ball nothing (the moves are on the move stick, SHOOT and
              PASS take the side), or on a second stick a plain stick flicked for a dribble move (engine.js) */}
          <div className="btlv-ds" ref={set('ds')}>
            <span className="btlv-ds-steal" ref={set('stl')} />
            <i className="btlv-ds-knob" ref={set('dk')} />
          </div>
          <button className="btlv-btn btlv-btn-a" ref={set('a')}><b ref={set('la')} /><small ref={set('sa')} /></button>
          <button className="btlv-btn btlv-btn-b" ref={set('b')}><span ref={set('lb')} /></button>
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
