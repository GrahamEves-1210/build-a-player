import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { SkRows } from './Skeleton'
import { createPortal } from 'react-dom'
import { POSITIONS, POS_LABEL, POS_NAME, SPOTS, SOCCER_SHAPES, spotsFor, bySpot, countOf, canAdd, spotsOf, nextToBuild, newSquad, addSlots, dropSlot, isFull, fullSize, afterBuilding } from '../../lib/squad'
import { soccerOrdinal, runSquadSeason, lineupOf, rosterOf, roleOf, projectedMinutes, squadStrength, teamGrade, teamOf, logoOf, ovrOf, nameOf, faceOf, spotOfBuild, SPOT_LABEL, olSpotOfBuild, loadSquadLegends, legendsReady } from '../../lib/squadSeason'
import { WeekStrip, Bracket, RingCeremony, SeasonRewards } from './AppSeason'
import { TeamResult, SafeView, isTeamResult, outcome, Face, lastName, fmt, TeamCrest, soccerRecord } from './SquadSeason'
import { sfx, haptic, victory } from '../../lib/juice'
import { getUsername } from '../../lib/discord'
import { IconClose, IconArrow, IconTrophy, IconCheck, IconSwap, IconPlay } from './icons'
import './squad-soccer.css'
import './squad-baseball.css'
// baseball's club board and season (its own chunk: it reads lib/squadBaseball.js, loaded with a baseball squad only)
const BaseballBoard = lazy(() => import('./SquadBaseball').then(m => ({ default: m.BaseballBoard })))
const BaseballResult = lazy(() => import('./SquadBaseball'))
const BaseballTrophy = lazy(() => import('./SquadBaseball').then(m => ({ default: m.BaseballTrophy })))

// SQUAD BUILDER (football, basketball and soccer): pick the positions (basketball: the
// spots, PG to C; soccer: the front line, a front three or a front two and a No. 10, on a
// club or a nation), build each one
// (the game's own build pages: the app routes those), pick a real team, set the
// lineup (basketball) and play one season together. Then run it back: add a
// player, cut one, change the team. The squad is lib/squad.js, the season
// lib/squadSeason.js.
//
// `renderPicker(onPick, build)` is the sport's own team picker; `onBuild(squad)`
// sends the app to the build page for the squad's next unbuilt player.

// ── Position tiles: tap to add, the minus to take one off ───────────────────
// Past a position's cap the tile shakes and says so (the caps aren't printed)
function PosTiles({ sport, slots, onAdd, onRemove }) {
  const [maxed, setMaxed] = useState(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const add = pos => {
    if (!canAdd(sport, slots, pos)) {
      setMaxed({ pos, k: Date.now() }); sfx('deny'); haptic('light')
      clearTimeout(timer.current); timer.current = setTimeout(() => setMaxed(null), 1600)
      return
    }
    onAdd(pos); sfx('tap'); haptic('light')
  }
  return (
    <div className={`sq-tiles sq-tiles--${sport}`}>
      {POSITIONS[sport].map(pos => {
        const n = countOf(slots, pos), hot = maxed?.pos === pos
        return (
          <div key={`${pos}-${hot ? maxed.k : 0}`} className={`sq-tile${n ? ' is-on' : ''}${hot ? ' is-max' : ''}`}>
            <button className="sq-tile-add" onClick={() => add(pos)} aria-label={`Add a ${pos === 'dl' ? 'Defensive Lineman' : pos === 'ol' ? 'Offensive Lineman' : POS_NAME[pos]}`}>
              <span className="sq-tile-pos">{POS_LABEL[pos]}</span>
              <span className="sq-tile-name">{hot ? <em>Max amount for position</em> : POS_NAME[pos]}</span>
              <span className="sq-tile-n">{n ? `×${n}` : '+'}</span>
            </button>
            {n > 0 && onRemove && <button className="sq-tile-minus" onClick={() => { onRemove(pos); sfx('back') }} aria-label={`Take a ${pos === 'dl' ? 'Defensive Lineman' : pos === 'ol' ? 'Offensive Lineman' : POS_NAME[pos]} off`}>−</button>}
          </div>
        )
      })}
    </div>
  )
}

// ── Basketball: the five spots, PG to C, each one once. Tap a spot to fill it,
// tap it again to leave it open; a spot whose player is built shakes (cut them
// from the squad instead). ──
function SpotTiles({ taken, built = [], onAdd, onRemove, spots = SPOTS, sport = 'bucket' }) {
  const [held, setHeld] = useState(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const tap = i => {
    if (built.includes(i)) {
      setHeld({ i, k: Date.now() }); sfx('deny'); haptic('light')
      clearTimeout(timer.current); timer.current = setTimeout(() => setHeld(null), 1600)
      return
    }
    if (taken.includes(i)) { onRemove(i); sfx('back') } else { onAdd(i); sfx('tap') }
    haptic('light')
  }
  return (
    <div className={`sq-tiles sq-tiles--spots${sport === 'soccer' ? ' sq-tiles--front' : sport === 'baseball' ? ' sq-tiles--baseball' : ''}`}>
      {spots.map((sp, i) => {
        const on = taken.includes(i), hot = held?.i === i
        // (baseball: the lineup, then the staff, each under its own head)
        const head = sport === 'baseball' && (i === 0 || spots[i - 1].pos !== sp.pos) ? <span key={`h${i}`} className="sq-tiles-head">{sp.pos === 'bat' ? 'THE LINEUP' : 'THE ROTATION AND THE CLOSER'}</span> : null
        return [head,
          <div key={`${i}-${hot ? held.k : 0}`} className={`sq-tile${on ? ' is-on' : ''}${hot ? ' is-max' : ''}`}>
            <button className="sq-tile-add" onClick={() => tap(i)} aria-pressed={on} aria-label={`${sp.name}${on ? ', on the squad' : ''}`}>
              <span className="sq-tile-pos">{sp.label}</span>
              <span className="sq-tile-name">{hot ? <em>Built: cut them above</em> : sp.name}</span>
              <span className="sq-tile-n">{on ? <IconCheck size={16} /> : '+'}</span>
            </button>
          </div>,
        ]
      })}
      {sport === 'soccer' && (
        <div className="sq-tile is-soon" aria-disabled="true">
          <span className="sq-tile-add"><span className="sq-tile-pos">GK</span><span className="sq-tile-name">Goalkeeper · COMING SOON</span><span className="sq-tile-n">—</span></span>
        </div>
      )}
    </div>
  )
}

// ── Soccer: where the squad plays (TOP DIVISIONS: a club; WORLD CUP: a nation) and its shape ──
function Seg({ value, options, onChange, label }) {
  return (
    <div className="ag-seg sq-seg" role="tablist" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'is-on' : ''} onClick={() => { if (value !== id) { onChange(id); sfx('tap'); haptic('light') } }}>
          {value === id && <span className="ag-seg-pill" />}{text}
        </button>
      ))}
    </div>
  )
}
const POOL_OPTS = [['current', 'TOP DIVISIONS'], ['alltime', 'WORLD CUP']]
const BB_POOL_OPTS = [['current', 'CURRENT'], ['alltime', 'ALL-TIME']]
const SHAPE_OPTS = Object.entries(SOCCER_SHAPES).map(([id, sh]) => [id, `${sh.name} · ${sh.label}`])

// What a build is called: its position (basketball: its spot, PG to C; the line: EDGE or
// DT from its Size chip, once it's built)
const DL_SPOT_NAME = { edge: 'Edge Rusher', dt: 'Defensive Tackle' }
const OL_SPOT_NAME = { LT: 'Left Tackle', LG: 'Left Guard', C: 'Center', RG: 'Right Guard', RT: 'Right Tackle' }
function tagOf(sq, s) {
  if (s.pos === 'ol') {
    if (!s.build) return { label: POS_LABEL.ol, name: 'Offensive Lineman' }
    const spot = olSpotOfBuild(s.build)
    return { label: spot, name: OL_SPOT_NAME[spot] }
  }
  if (s.pos === 'dl') {
    if (!s.build) return { label: POS_LABEL.dl, name: 'Defensive Lineman' }
    const spot = spotOfBuild(s.build)
    return { label: SPOT_LABEL[spot], name: DL_SPOT_NAME[spot] }
  }
  const i = bySpot(sq?.sport) ? spotsOf(sq)[s.id] : null
  return i != null ? spotsFor(sq)[i] : { label: POS_LABEL[s.pos], name: POS_NAME[s.pos] }
}

// ── A build in the squad: face, position, name, OVR ─────────────────────────
function BuildRow({ sq, s, owner, onDrop, children }) {
  const ovr = s.build ? ovrOf(s.pos, s.build) : null
  const t = tagOf(sq, s)
  return (
    <div className={`sq-row${s.build ? '' : ' is-todo'}`}>
      <Face src={s.build ? faceOf(s.build) : null} name={t.label} mine />
      <span className="sq-row-txt">
        <b>{s.build ? nameOf(s.pos, s.build) ?? t.name : `${t.name} · to build`}</b>
        <small>{t.label} · {owner}{s.sandbox ? ' · SANDBOX' : ''}</small>
      </span>
      {children}
      {ovr != null && <span className="sq-ovr"><b>{ovr}</b><small>OVR</small></span>}
      {onDrop && <button className="sq-row-x" onClick={onDrop} aria-label="Take off the squad"><IconClose size={14} /></button>}
    </div>
  )
}

function Head({ kicker, title, onClose, right }) {
  return (
    <div className="ag-screen-head">
      <div><span className="ag-eyebrow">{kicker}</span><h1 className="ag-h1">{title}</h1></div>
      {right}
      {onClose && <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>}
    </div>
  )
}

// the sport's team picker, with a way back out when picking is optional
function Picker({ render, squad, onPick, onClose }) {
  const merged = useMemo(() => Object.fromEntries(squad.slots.filter(s => s.build).flatMap(s => Object.entries(s.build).map(([t, c]) => [`${s.id}:${t}`, c]))), [squad.slots])
  return createPortal(
    <div className="sq-picker">
      {render(onPick, merged, squad)}
      {onClose && <button className="ag-round-btn sq-picker-x" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>}
    </div>,
    document.body,
  )
}

// ── Team strength: the real team, and what the builds did to it ─────────────
function Strength({ sport, squad, owner }) {
  const st = useMemo(() => squadStrength(squad), [squad])
  // a grade on the game's F–S scale; a build that moved it shows where it was
  const row = (label, now, was) => {
    const g = teamGrade(sport, now, squad.pool), was0 = teamGrade(sport, was, squad.pool)
    return <span className="sq-str-cell"><small>{label}</small><b>{g}</b>{g !== was0 && <i className={now > was ? 'is-up' : 'is-down'}>from {was0}</i>}</span>
  }
  return (
    <div className="sq-str">
      {row(sport === 'soccer' ? 'ATTACK' : 'OFFENSE', st.off, st.baseOff)}
      {row(sport === 'soccer' ? 'DEFENCE' : 'DEFENSE', st.def, st.baseDef)}
      <span className="sq-str-note">{sport === 'soccer' ? `With ${owner}'s builds up front, against the forwards they replace` : sport === 'baseball' ? `The club with ${owner}'s builds, against the men they replace` : `The team with ${owner}'s builds, against the ${squad.pool === 'alltime' ? 'legends' : 'starters'} they replace`}</span>
    </div>
  )
}

// ── Football: the depth chart (who starts, and the depth that still plays) ──
// Every man in the season's rotation at his job: the builds (by name) and the team's real
// players, starters first, then the backups who play (RB2 and RB3, WR4, the line's rotation,
// the nickel). Anyone the builds pushed further down sits.
function DepthChart({ squad, owner }) {
  const L = useMemo(() => lineupOf(squad), [squad])
  const roster = useMemo(() => rosterOf(squad), [squad])
  const playing = new Set(roster.map(p => p.n))
  // a real player's headshot (the lineup's own copy has it)
  const photo = useMemo(() => {
    const m = {}
    for (const pos of Object.keys(L.groups)) for (const q of [...L.groups[pos].filter(g => g.real).map(g => g.real), ...(L.rotation?.[pos] ?? [])]) m[q.name] = q.photo
    return m
  }, [L])
  return (
    <section className="sq-depth ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE DEPTH CHART</span></div>
      {POSITIONS.nfl.map(pos => {
        const at = roster.filter(p => p.pos === pos)
        const starts = at.filter(p => p.st), backs = at.filter(p => !p.st)
        const sits = (L.benched[pos] ?? []).filter(p => !playing.has(p.name))
        return (
          <div key={pos} className="sq-depth-grp">
            <span className="sq-depth-pos">{POS_LABEL[pos]}</span>
            <div className="sq-depth-list">
              {starts.map(p => {
                const s = p.s ? squad.slots.find(x => x.id === p.s) : null
                return s
                  ? <span key={p.k} className="sq-chip is-mine"><Face src={faceOf(s.build)} name={POS_LABEL[pos]} mine size={30} /><b>{nameOf(pos, s.build)}</b><small>{roleOf(p, roster)} · {p.o} · {owner}</small></span>
                  : <span key={p.k} className="sq-chip"><Face src={photo[p.n]} name={p.n} size={30} /><b>{lastName(p.n)}</b><small>{roleOf(p, roster)} · {p.o}</small></span>
              })}
              {backs.length > 0 && <span className="sq-depth-sub">{backs.map(p => `${lastName(p.n)} ${roleOf(p, roster)}`).join(' · ')}</span>}
              {sits.length > 0 && <span className="sq-bench">To the bench: {sits.map(p => lastName(p.name)).join(', ')}</span>}
            </div>
          </div>
        )
      })}
    </section>
  )
}

// ── Basketball: the lineup board. Each build starts at the spot it was picked
// for; drag it to another (guards 1–3, bigs 4–5), or tap it and tap the spot.
// The team's real starters fill the rest. ──
const SPOT_XY = [[50, 17], [17, 42], [83, 42], [30, 75], [70, 75]]
function LineupBoard({ squad, setSquad, owner }) {
  const { spots, rotation } = useMemo(() => lineupOf(squad), [squad])
  const bench = rotation?.bench ?? []
  const mins = useMemo(() => projectedMinutes(squad), [squad])
  const [drag, setDrag] = useState(null)       // { id, pos, from, x, y, moved }
  const [sel, setSel] = useState(null)         // a build picked up by a tap
  const [bad, setBad] = useState(null)         // a spot that can't take it (shakes)
  const boardRef = useRef(null)
  const move = (id, to) => {
    const from = spots.findIndex(x => x?.you?.id === id)
    if (from === to) return
    const slot = squad.slots.find(s => s.id === id)
    if (!slot || SPOTS[to]?.pos !== slot.pos) { setBad({ i: to, k: Date.now() }); sfx('deny'); haptic('light'); return }
    const lineup = Object.fromEntries(spots.map((x, i) => [x?.you?.id, i]).filter(([k]) => k))
    const there = spots[to]?.you?.id
    lineup[id] = to
    if (there) lineup[there] = from
    setSquad({ ...squad, lineup })
    sfx('drop'); haptic('light')
  }
  const spotAt = (x, y) => {
    const el = document.elementsFromPoint(x, y).find(e => e.dataset?.spot != null)
    return el ? +el.dataset.spot : null
  }
  const down = (e, s, i) => {
    if (e.button > 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    setDrag({ id: s.id, pos: s.pos, from: i, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false })
  }
  const over = e => setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8 } : d))
  const dragged = useRef(0)     // a drag ends in a click on the spot it started from: that click isn't a tap
  const up = e => {
    const d = drag
    setDrag(null)
    if (!d?.moved) return
    dragged.current = Date.now()
    const to = spotAt(e.clientX, e.clientY)
    if (to != null) move(d.id, to)
  }
  // tap a build to pick it up, then tap the spot it goes to
  const tapSpot = i => {
    if (Date.now() - dragged.current < 350) return
    const here = spots[i]?.you?.id
    if (!sel) { if (here) { setSel(here); sfx('tap') } return }
    if (here === sel) { setSel(null); return }
    const pos = squad.slots.find(q => q.id === sel)?.pos
    if (SPOTS[i].pos !== pos) { if (here) { setSel(here); sfx('tap') } else { setBad({ i, k: Date.now() }); sfx('deny') } return }
    move(sel, i); setSel(null)
  }
  const box = boardRef.current?.getBoundingClientRect()
  return (
    <section className="sq-board-wrap ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE LINEUP · DRAG {owner.toUpperCase()}'S BUILDS</span></div>
      <div className="sq-board" ref={boardRef}>
        <svg className="sq-court" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="98" height="98" rx="3" />
          <path d="M34 99 V62 H66 V99" />
          <circle cx="50" cy="62" r="12" />
          <path d="M8 99 V82 A44 44 0 0 1 92 82 V99" />
          <circle cx="50" cy="93" r="2.4" />
        </svg>
        {SPOTS.map((sp, i) => {
          const x = spots[i], mine = !!x?.you, s = x?.you
          const picked = mine && (sel === s.id || drag?.id === s.id)
          const target = (drag?.moved || sel) && sp.pos === (drag?.pos ?? squad.slots.find(q => q.id === sel)?.pos)
          return (
            <div key={`${i}-${bad?.i === i ? bad.k : 0}`} data-spot={i} className={`sq-spot${mine ? ' is-mine' : ''}${picked ? ' is-picked' : ''}${target ? ' is-target' : ''}${bad?.i === i ? ' is-bad' : ''}`}
              style={{ left: `${SPOT_XY[i][0]}%`, top: `${SPOT_XY[i][1]}%` }} onClick={() => tapSpot(i)}>
              {mine ? (
                <button className="sq-spot-me" onDragStart={e => e.preventDefault()} onPointerDown={e => down(e, s, i)} onPointerMove={over} onPointerUp={up} onPointerCancel={() => setDrag(null)} aria-label={`Move ${nameOf(s.pos, s.build)}`}>
                  <Face src={faceOf(s.build)} name={POS_LABEL[s.pos]} mine size={52} />
                </button>
              ) : <Face src={x?.real?.photo} name={x?.real?.name} size={52} />}
              <span className="sq-spot-lbl">{sp.label}</span>
              <b className="sq-spot-name">{mine ? nameOf(s.pos, s.build) : x?.real ? lastName(x.real.name) : 'Open'}</b>
              <small className="sq-spot-ovr">{mine ? `${ovrOf(s.pos, s.build)} · ${owner}` : x?.real ? `${x.real.ovr} · ${mins[x.real.key ?? `r:${x.real.name}`] ?? 0} MIN` : ''}</small>
            </div>
          )
        })}
        {drag?.moved && box && (() => {
          const s = squad.slots.find(q => q.id === drag.id)
          return <span className="sq-ghost" style={{ left: drag.x - box.left, top: drag.y - box.top }}><Face src={faceOf(s?.build)} name={POS_LABEL[s?.pos]} mine size={56} /></span>
        })()}
      </div>
      <p className="sq-board-note">{sel ? 'Now tap the spot to move them to.' : 'The 1, 2 and 3 can swap; so can the 4 and 5. The point and the four run the offense.'}</p>
      {bench.length > 0 && (
        <div className="sq-depth-grp sq-benchrow">
          <span className="sq-depth-pos">BN</span>
          <div className="sq-depth-list">
            {bench.map((p, i) => <span key={p.key ?? p.name} className="sq-chip"><Face src={p.photo} name={p.name} size={30} /><b>{lastName(p.name)}</b><small>BN{i + 1} · {p.ovr} · {mins[p.key ?? `r:${p.name}`] ?? 0} MIN</small></span>)}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Soccer: the front line on the pitch. Each build plays the spot it was picked for; drag it to
// another (or tap it, then the spot): any striker can play any spot up front. The side's real
// forwards fill the rest, and its own midfield and back line are behind them. The shape switches
// between a front three and a front two with a No. 10. ──
const MIDS = new Set(['AM', 'CM', 'DM'])
const FRONT_XY = { '433': [[18, 44], [50, 31], [82, 44]], '4312': [[30, 30], [70, 30], [50, 72]] }
function FrontLine({ squad, setSquad, owner }) {
  const L = useMemo(() => lineupOf(squad), [squad])
  const list = spotsFor(squad)
  const xy = FRONT_XY[squad.shape] ?? FRONT_XY['433']
  const [drag, setDrag] = useState(null)
  const [sel, setSel] = useState(null)
  const boardRef = useRef(null)
  const dragged = useRef(0)
  const move = (id, to) => {
    const from = L.spots.findIndex(x => x?.you?.id === id)
    if (from === to || to == null) return
    const lineup = Object.fromEntries(L.spots.map((x, i) => [x?.you?.id, i]).filter(([k]) => k))
    const there = L.spots[to]?.you?.id
    lineup[id] = to
    if (there) lineup[there] = from
    setSquad({ ...squad, lineup })
    sfx('drop'); haptic('light')
  }
  const spotAt = (x, y) => { const el = document.elementsFromPoint(x, y).find(e => e.dataset?.spot != null); return el ? +el.dataset.spot : null }
  const down = (e, s) => {
    if (e.button > 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    setDrag({ id: s.id, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false })
  }
  const over = e => setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8 } : d))
  const up = e => { const d = drag; setDrag(null); if (!d?.moved) return; dragged.current = Date.now(); move(d.id, spotAt(e.clientX, e.clientY)) }
  const tapSpot = i => {
    if (Date.now() - dragged.current < 350) return
    const here = L.spots[i]?.you?.id
    if (!sel) { if (here) { setSel(here); sfx('tap') } return }
    if (here === sel) { setSel(null); return }
    move(sel, i); setSel(null)
  }
  const box = boardRef.current?.getBoundingClientRect()
  const pushed = L.benched?.st ?? []
  const behind = (L.rotation?.bench ?? []).filter(p => !pushed.some(q => q.name === p.name))
  return (
    <section className="sq-board-wrap ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE FRONT LINE · DRAG {owner.toUpperCase()}'S BUILDS</span></div>
      <Seg value={squad.shape ?? '433'} options={SHAPE_OPTS} label="Shape" onChange={shape => setSquad({ ...squad, shape })} />
      <div className="sq-board sq-board--pitch" ref={boardRef}>
        <svg className="sq-court sq-pitch" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1" y="1" width="98" height="98" rx="2" />
          <path d="M1 99 H99" />
          <path d="M22 1 V17 H78 V1" />
          <path d="M38 1 V7 H62 V1" />
          <path d="M40 17 A12 9 0 0 0 60 17" />
          <path d="M30 99 A20 14 0 0 1 70 99" />
          <circle cx="50" cy="12" r=".9" />
        </svg>
        {list.map((sp, i) => {
          const x = L.spots[i], mine = !!x?.you, s = x?.you
          const picked = mine && (sel === s.id || drag?.id === s.id)
          const target = (drag?.moved || sel) && !picked
          return (
            <div key={i} data-spot={i} className={`sq-spot${mine ? ' is-mine' : ''}${picked ? ' is-picked' : ''}${target ? ' is-target' : ''}`}
              style={{ left: `${xy[i][0]}%`, top: `${xy[i][1]}%` }} onClick={() => tapSpot(i)}>
              {mine ? (
                <button className="sq-spot-me" onDragStart={e => e.preventDefault()} onPointerDown={e => down(e, s)} onPointerMove={over} onPointerUp={up} onPointerCancel={() => setDrag(null)} aria-label={`Move ${nameOf(s.pos, s.build)}`}>
                  <Face src={faceOf(s.build)} name={sp.label} mine size={52} />
                </button>
              ) : <Face src={x?.real?.photo} name={x?.real?.name ?? sp.label} size={52} />}
              <span className="sq-spot-lbl">{sp.label}</span>
              <b className="sq-spot-name">{mine ? nameOf(s.pos, s.build) : x?.real ? lastName(x.real.name) : 'Squad player'}</b>
              <small className="sq-spot-ovr">{mine ? `${ovrOf(s.pos, s.build)} · ${owner}` : x?.real ? `${x.real.ovr} · ${x.real.role}` : 'Open'}</small>
            </div>
          )
        })}
        {drag?.moved && box && (() => {
          const s = squad.slots.find(q => q.id === drag.id)
          return <span className="sq-ghost" style={{ left: drag.x - box.left, top: drag.y - box.top }}><Face src={faceOf(s?.build)} name="ST" mine size={56} /></span>
        })()}
      </div>
      <p className="sq-board-note">{sel ? 'Now tap the spot to move them to.' : 'Any striker can play any spot up front. The No. 9 gets the most of the chances.'}</p>
      {pushed.length > 0 && <span className="sq-bench">To the bench: {pushed.map(p => lastName(p.name)).join(', ')}</span>}
      {[['MF', behind.filter(p => MIDS.has(p.role))], ['BN', behind.filter(p => !MIDS.has(p.role))]].map(([tag, ps]) => ps.length > 0 && (
        <div key={tag} className="sq-depth-grp sq-benchrow">
          <span className="sq-depth-pos">{tag}</span>
          <div className="sq-depth-list">
            {ps.map(p => <span key={p.name} className="sq-chip"><Face src={p.photo} name={p.name} size={30} /><b>{lastName(p.name)}</b><small>{p.role} · {p.ovr}</small></span>)}
          </div>
        </div>
      ))}
    </section>
  )
}

// ── The season's result ──────────────────────────────────────────────────────
// A season from the team engine shows the team's season (SquadSeason.jsx); a season saved before it
// (only the builds' lines) shows the way it always did, and so does a new one if its view breaks.
function SeasonLines({ r, squad, owner }) {
  const bySlot = Object.fromEntries(squad.slots.map(s => [s.id, s]))
  return (
    <section className="sq-lines ag-pop" style={{ '--d': '120ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE SQUAD'S NUMBERS</span></div>
      {(r.lines ?? []).map(l => (
        <div key={l.id} className={`sq-line${l.award?.won ? ' is-award' : ''}`}>
          <div className="sq-line-top">
            <Face src={l.face} name={POS_LABEL[l.pos]} mine />
            <span className="sq-row-txt">
              <b>{l.name ?? POS_NAME[l.pos]}</b>
              <small>{l.tag ?? SPOTS[l.spot]?.label ?? POS_LABEL[l.pos]} · {owner}{bySlot[l.id] ? '' : ' · cut'}</small>
            </span>
            {l.award?.won && <span className="sq-award"><IconTrophy size={13} /> {l.award.name}</span>}
            <span className="sq-ovr"><b>{l.ovr}</b><small>OVR</small></span>
          </div>
          <div className="sq-stats">{(l.stats ?? []).map(([k, v]) => <span key={k}><b>{fmt(v)}</b><small>{k}</small></span>)}</div>
        </div>
      ))}
    </section>
  )
}
function OldResult({ sport, squad, owner }) {
  const r = squad.last
  if (sport === 'soccer') {
    const team = teamOf(sport, r.team, r.pool)
    return (
      <div className={`sq-hero ag-pop${r.champion ? ' is-champ' : ''}`} style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
        <TeamCrest sport={sport} short={r.team} pool={r.pool} className="sq-hero-logo" />
        <span className="sq-hero-txt">
          <span className="ag-eyebrow">{team?.name ?? r.team}</span>
          <b className="sq-hero-rec">{soccerRecord(r)}</b>
          <small className="sq-hero-out">{outcome(r)}</small>
        </span>
      </div>
    )
  }
  const team = teamOf(sport, r.team)
  return (
    <>
      <div className={`sq-hero ag-pop${r.champion ? ' is-champ' : ''}`} style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
        <img className="sq-hero-logo" src={logoOf(sport, r.team)} alt="" />
        <span className="sq-hero-txt">
          <span className="ag-eyebrow">{team?.name ?? r.team}</span>
          <b className="sq-hero-rec">{r.wins}<i>–</i>{r.losses}</b>
          <small className="sq-hero-out">{r.champion && <IconTrophy size={14} />} {outcome(r)}</small>
        </span>
      </div>
      {r.sandbox && <p className="sq-note">SANDBOX squad: just for fun, no XP or coins.</p>}
      {sport === 'bucket' ? (
        <section className="sq-po ag-pop" style={{ '--d': '60ms' }}>
          {r.log && <div className="sq-log" aria-label={`${r.wins} wins, ${r.losses} losses`}>{r.log.split('').map((c, i) => <i key={i} className={c === 'W' ? 'is-w' : 'is-l'} />)}</div>}
          {(r.rounds ?? []).map((x, i) => (
            <div key={i} className={`sq-po-row${x.won ? ' is-w' : ' is-l'}`}>
              <span>{x.type === 'playin' ? 'PLAY-IN' : (x.name ?? '').toUpperCase()}</span>
              {x.opponent && <img src={logoOf('bucket', x.opponent)} alt="" />}
              <b>{x.type === 'playin' ? (x.won ? 'IN' : 'OUT') : `${x.wins}-${x.losses}`}</b>
            </div>
          ))}
        </section>
      ) : sport === 'baseball' ? null : (
        <section className="sq-po ag-pop" style={{ '--d': '60ms' }}>
          {r.games?.length > 0 && <WeekStrip games={r.games} revealed={r.games.length} />}
          {r.playoffs && r.rounds?.length > 0 && <Bracket rounds={r.rounds} gameIdx={r.rounds.length - 1} status={r.champion ? 'champion' : 'eliminated'} hasBye={r.hasBye} />}
        </section>
      )}
      <SeasonLines r={r} squad={squad} owner={owner} />
      <SeasonRewards result={r} />
    </>
  )
}
function Result({ sport, squad, owner, reveal, onRevealed }) {
  const old = <OldResult sport={sport} squad={squad} owner={owner} />
  if (!isTeamResult(squad.last)) { if (reveal) setTimeout(onRevealed, 0); return old }
  if (sport === 'baseball') {
    return (
      <SafeView fallback={old}>
        <Suspense fallback={null}><BaseballResult squad={squad} owner={owner} reveal={reveal} onRevealed={onRevealed} rewards={<SeasonRewards result={squad.last} />} /></Suspense>
      </SafeView>
    )
  }
  return (
    <SafeView fallback={old}>
      <TeamResult sport={sport} squad={squad} owner={owner} reveal={reveal} onRevealed={onRevealed} rewards={<SeasonRewards result={squad.last} />} />
    </SafeView>
  )
}

// ── Run it back: add a player, cut one, change the team ─────────────────────
function RunItBack({ sport, squad, owner, renderPicker, onApply, onCancel }) {
  const [draft, setDraft] = useState(squad)
  const [picking, setPicking] = useState(false)
  const built = draft.slots.filter(s => s.build).length
  const toBuild = draft.slots.filter(s => !s.build).length
  const team = teamOf(sport, draft.team, draft.pool)
  const removePos = pos => { const s = [...draft.slots].reverse().find(x => x.pos === pos && !x.build); if (s) setDraft(dropSlot(draft, s.id)) }
  const at = bySpot(sport) ? spotsOf(draft) : {}
  const removeSpot = i => { const s = draft.slots.find(x => at[x.id] === i && !x.build); if (s) setDraft(dropSlot(draft, s.id)) }
  return (
    <>
      <section className="sq-edit ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">THE SQUAD · {draft.slots.length} OF {fullSize(sport)}</span></div>
        {draft.slots.map(s => <BuildRow key={s.id} sq={draft} s={s} owner={owner} onDrop={draft.slots.length > 1 ? () => { setDraft(dropSlot(draft, s.id)); sfx('back') } : null} />)}
      </section>
      <section className="sq-edit ag-pop" style={{ '--d': '60ms' }}>
        <div className="ag-card-head"><span className="ag-eyebrow">ADD A PLAYER</span></div>
        {bySpot(sport)
          ? <SpotTiles sport={sport} spots={spotsFor(draft)} taken={Object.values(at)} built={draft.slots.filter(s => s.build).map(s => at[s.id])} onAdd={i => setDraft(addSlots(draft, [i]))} onRemove={removeSpot} />
          : <PosTiles sport={sport} slots={draft.slots} onAdd={pos => setDraft(addSlots(draft, [pos]))} onRemove={draft.slots.some(s => !s.build) ? removePos : null} />}
      </section>
      <section className="sq-edit sq-edit-team ag-pop" style={{ '--d': '90ms' }}>
        <TeamCrest sport={sport} short={draft.team} pool={draft.pool} />
        <span className="sq-row-txt"><b>{team?.name ?? draft.team}</b><small>{draft.team === squad.team ? 'Same team' : `New team (was ${squad.team})`}</small></span>
        <button className="ag-btn ag-btn--ghost sq-team-btn" onClick={() => { setPicking(true); sfx('tap') }}><IconSwap size={15} /> CHANGE TEAM</button>
      </section>
      <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '120ms' }} disabled={!draft.slots.length || !built && !toBuild}
        onClick={() => onApply(draft)}>
        {toBuild ? `BUILD ${toBuild} NEW ${toBuild === 1 ? 'PLAYER' : 'PLAYERS'}` : (sport === 'bucket' || sport === 'baseball' ? 'SET THE LINEUP' : sport === 'soccer' ? 'SET THE FRONT LINE' : 'SEE THE DEPTH CHART')} <IconArrow size={16} />
      </button>
      <button className="ag-btn ag-btn--ghost" onClick={onCancel}>BACK TO THE RESULTS</button>
      {picking && <Picker render={renderPicker} squad={draft} onPick={t => { setDraft({ ...draft, team: t.short }); setPicking(false) }} onClose={() => setPicking(false)} />}
    </>
  )
}

// a soccer run in the squad's list: the trophies, or where the side finished
function runLine(s) {
  if (s.trophies?.length) return s.trophies.join(', ')
  if (s.pool === 'alltime') return s.finish ?? (s.playoffs ? 'Knockouts' : 'Group stage')
  return s.pos ? `${soccerOrdinal(s.pos)} in the league` : 'League season'
}

// ── The screen ───────────────────────────────────────────────────────────────
export default function AppSquad({ sport, squad, setSquad, user, renderPicker, onBuild, onExit }) {
  const owner = user ? (getUsername(user) || 'Player') : 'Guest'
  const [picks, setPicks] = useState([])            // a new squad's positions (basketball, soccer: spots), before it starts
  const [pool, setPool] = useState('current')       // soccer: TOP DIVISIONS (a club) or WORLD CUP (a nation)
  const [shape, setShape] = useState('433')         // soccer: a front three or a front two and a No. 10
  const [editing, setEditing] = useState(false)     // run it back
  const [confirmNew, setConfirmNew] = useState(false)
  const [ring, setRing] = useState(null)
  const [pickOpen, setPickOpen] = useState(true)     // the team picker, open as the team step starts
  const [playing, setPlaying] = useState(null)       // the season just simmed, playing out (its result's time)
  const phase = !squad ? 'pick' : squad.phase
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.sq')?.scrollTo({ top: 0, behavior: 'instant' }) }, [phase, editing])
  useEffect(() => { if (phase === 'team') setPickOpen(true) }, [phase])
  // ALL-TIME (football, basketball): the franchises' legends load with the squad; it shows once they're in
  const needLegends = (sport === 'nfl' || sport === 'bucket') && squad?.pool === 'alltime'
  const [, setLegendsIn] = useState(0)
  useEffect(() => {
    if (!needLegends || legendsReady(sport)) return
    let live = true
    loadSquadLegends(sport).then(() => { if (live) setLegendsIn(n => n + 1) }, () => {})
    return () => { live = false }
  }, [needLegends, sport])

  const start = () => {
    const sq = newSquad({ sport, uid: user?.id ?? null, picks, pool, shape })
    setPicks([]); setSquad(sq); sfx('confirm'); onBuild(sq)
  }
  const startOver = () => { setConfirmNew(false); setEditing(false); setSquad(null); sfx('back') }
  const sim = () => {
    const r = runSquadSeason(squad)
    const seasons = [...(squad.seasons ?? []), { n: r.n, team: r.team, wins: r.wins, losses: r.losses, playoffs: r.playoffs, champion: r.champion, awards: sport === 'soccer' ? r.lines.flatMap(l => l.awards ?? []) : r.lines.filter(l => l.award?.won).map(l => l.award.name), size: r.size, sandbox: r.sandbox, at: r.at, ...(sport === 'soccer' && { draws: r.draws, points: r.points, pool: r.pool, pos: r.seed, finish: r.finish ?? null, trophies: r.trophies }), ...((sport === 'nfl' || sport === 'bucket') && { pool: r.pool ?? 'current' }) }]
    setSquad({ ...squad, last: r, seasons, phase: 'result' })
    // a season like any other: XP, coins, missions (lib/progress.js onSeason); sandbox pays nothing
    const won = r.lines.find(l => l.award?.won)
    window.dispatchEvent(new CustomEvent('bap:season', { detail: {
      sport: sport === 'bucket' || sport === 'soccer' || sport === 'baseball' ? sport : 'nfl', pos: null, mode: 'squad', localOnly: true,
      wins: r.wins, losses: r.losses, playoffs: !!r.playoffs, champion: !!r.champion,
      award: !!won, awardName: won?.award.name, ovr: Math.max(0, ...r.lines.map(l => l.ovr)),
      sandbox: !!squad.sandbox, full: isFull(squad), ref: r, ...(sport === 'baseball' && { awards: r.tags ?? [] }),
    } }))
    setPlaying(r.at)   // the season plays out first; its ring and sound come at the end (revealed)
  }
  const revealed = () => {
    setPlaying(null)
    const r = squad?.last
    if (!r) return
    if (r.champion) { victory({ big: true }); if (sport !== 'soccer') setRing(r) } else sfx(r.playoffs ? 'claim' : 'tap')
  }
  const anotherTeam = () => { setPickOpen(true); setSquad({ ...squad, phase: 'team' }); sfx('tap') }
  const apply = draft => {
    setEditing(false)
    const next = { ...draft, phase: draft.slots.some(s => !s.build) ? 'build' : 'ready' }
    setSquad(next)
    if (next.phase === 'build') onBuild(next)
  }

  const exit = <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
  const steps = sport === 'baseball' ? [
    ['Pick the spots', 'C to DH, the five starters and the closer: fill one spot or the whole club.'],
    ['Build each one', 'The normal spins, one player after another.'],
    ['Pick a team', `A 2026 club, or a franchise's legends. Its real players fill every spot ${owner} doesn't build.`],
    ['Play the season', 'One club, 162 games and October: a box score every game, a line and awards for every build. Then run it back.'],
  ] : [
    sport === 'bucket' ? ['Pick the spots', 'PG to C: fill one spot or all five.'] : sport === 'soccer' ? ['Pick the front line', 'Up to three strikers: a front three, or a front two and a No. 10.'] : ['Pick the positions', 'QB, RBs, WRs, TEs, DBs and DLs: as many as a starting lineup holds.'],
    ['Build each one', 'The normal spins, one player after another.'],
    sport === 'soccer' ? ['Pick a side', 'A club in the top divisions, or a nation at the World Cup. Its real players fill the rest of the XI.'] : ['Pick a team', pool === 'alltime' ? `A franchise's legends fill every spot ${owner} doesn't build. The builds start.` : `Its real roster fills every spot ${owner} doesn't build. The builds start.`],
    sport === 'soccer' ? ['Play the season', 'The league, the cup and Europe (or the World Cup) as one side: a line and awards for every build. Then run it back.'] : ['Play the season', 'One team, one schedule: a box score every game, a season and awards for every build. Then run it back.'],
  ]

  let body
  if (phase === 'pick') {
    body = (
      <>
        <section className="sq-edit ag-pop">
          <div className="ag-card-head"><span className="ag-eyebrow">PICK THE SQUAD · {picks.length} {picks.length === 1 ? 'PLAYER' : 'PLAYERS'}</span></div>
          {sport === 'soccer' && <Seg value={pool} options={POOL_OPTS} label="Where the squad plays" onChange={setPool} />}
          {sport === 'baseball' && <Seg value={pool} options={BB_POOL_OPTS} label="The players" onChange={setPool} />}
          {(sport === 'nfl' || sport === 'bucket') && <Seg value={pool} options={BB_POOL_OPTS} label="The players" onChange={p => { setPool(p); if (p === 'alltime') loadSquadLegends(sport).catch(() => {}) }} />}
          {sport === 'soccer' && <Seg value={shape} options={SHAPE_OPTS} label="Shape" onChange={setShape} />}
          {bySpot(sport)
            ? <SpotTiles sport={sport} spots={sport === 'soccer' ? SOCCER_SHAPES[shape].spots : spotsFor({ sport })} taken={picks} onAdd={i => setPicks(p => [...p, i].sort((a, b) => a - b))} onRemove={i => setPicks(p => p.filter(x => x !== i))} />
            : <PosTiles sport={sport} slots={picks.map(pos => ({ pos }))} onAdd={pos => setPicks(p => [...p, pos])}
              onRemove={pos => setPicks(p => { const i = p.lastIndexOf(pos); return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)] })} />}
        </section>
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '60ms' }} disabled={!picks.length} onClick={start}>
          {picks.length ? `BUILD ${picks.length} ${picks.length === 1 ? 'PLAYER' : 'PLAYERS'}` : bySpot(sport) ? 'PICK A SPOT' : 'PICK A POSITION'} <IconArrow size={16} />
        </button>
        <ol className="tk-steps ag-pop" style={{ '--d': '90ms' }}>
          {steps.map(([t, d], i) => <li key={t}><span className="tk-step-n">{i + 1}</span><span className="tk-step-txt"><b>{t}</b><small>{d}</small></span></li>)}
        </ol>
      </>
    )
  } else if (phase === 'build') {
    const next = nextToBuild(squad)
    const done = squad.slots.filter(s => s.build).length
    body = (
      <>
        <section className="sq-edit ag-pop">
          <div className="ag-card-head"><span className="ag-eyebrow">BUILT · {done} OF {squad.slots.length}</span></div>
          {squad.slots.map(s => <BuildRow key={s.id} sq={squad} s={s} owner={owner}>{!s.build && s.id === next?.id && <span className="sq-next">NEXT</span>}</BuildRow>)}
        </section>
        {next
          ? <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '60ms' }} onClick={() => { sfx('confirm'); onBuild(squad) }}>BUILD THE {bySpot(sport) ? tagOf(squad, next).name.toUpperCase() : POS_LABEL[next.pos]} <IconArrow size={16} /></button>
          : <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" onClick={() => setSquad({ ...squad, phase: afterBuilding(squad) })}>NEXT <IconArrow size={16} /></button>}
        <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmNew(true)}>NEW SQUAD</button>
      </>
    )
  } else if (phase === 'team') {
    body = (
      <>
        <section className="sq-edit ag-pop">
          <div className="ag-card-head"><span className="ag-eyebrow">{owner.toUpperCase()}'S BUILDS · {squad.slots.length}</span></div>
          {squad.slots.map(s => <BuildRow key={s.id} sq={squad} s={s} owner={owner} />)}
        </section>
        <p className="sq-note">{sport === 'soccer' ? `Pick a ${squad.pool === 'alltime' ? 'nation' : 'club'}: its real players fill the rest of the XI, and ${owner}'s builds lead the line.` : sport === 'baseball' ? `Pick a ${squad.pool === 'alltime' ? 'franchise: its legends' : 'club: its 2026 players'} fill every spot ${owner} didn't build, and the builds take the jobs they were built for.` : squad.pool === 'alltime' ? `Pick a franchise: its legends fill every spot ${owner} didn't build, and the builds take the starting jobs.` : `Pick a team: its real roster fills every spot ${owner} didn't build, and the builds take the starting jobs.`}</p>
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '60ms' }} onClick={() => { setPickOpen(true); sfx('tap') }}>{sport === 'soccer' ? (squad.pool === 'alltime' ? 'PICK A NATION' : 'PICK A CLUB') : 'PICK A TEAM'} <IconArrow size={16} /></button>
        {squad.team && <button className="ag-btn ag-btn--ghost" onClick={() => setSquad({ ...squad, phase: 'ready' })}>{sport === 'soccer' ? `KEEP ${(teamOf(sport, squad.team, squad.pool)?.name ?? squad.team).toUpperCase()}` : `KEEP THE ${squad.team}${squad.pool === 'alltime' && sport !== 'baseball' ? ' LEGENDS' : ''}`}</button>}
        {pickOpen && <Picker render={renderPicker} squad={squad} onPick={t => { setPickOpen(false); setSquad({ ...squad, team: t.short, phase: 'ready' }) }} onClose={() => setPickOpen(false)} />}
      </>
    )
  } else if (phase === 'ready' || (phase === 'result' && !squad.last)) {
    const team = teamOf(sport, squad.team, squad.pool)
    body = (
      <>
        <div className="sq-hero ag-pop" style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
          <TeamCrest sport={sport} short={squad.team} pool={squad.pool} className="sq-hero-logo" />
          <span className="sq-hero-txt">
            <span className="ag-eyebrow">{owner.toUpperCase()}'S SQUAD · {squad.slots.length} {squad.slots.length === 1 ? 'BUILD' : 'BUILDS'}{squad.pool === 'alltime' && (sport === 'nfl' || sport === 'bucket') ? ' · ALL-TIME' : ''}</span>
            <b className="sq-hero-team">{team?.name ?? squad.team}</b>
          </span>
        </div>
        <Strength sport={sport} squad={squad} owner={owner} />
        {sport === 'bucket' ? <LineupBoard squad={squad} setSquad={setSquad} owner={owner} /> : sport === 'baseball' ? <Suspense fallback={null}><BaseballBoard squad={squad} setSquad={setSquad} owner={owner} /></Suspense> : sport === 'soccer' ? <FrontLine squad={squad} setSquad={setSquad} owner={owner} /> : <DepthChart squad={squad} owner={owner} />}
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '120ms' }} onClick={sim}><IconPlay size={16} /> SIM THE SEASON</button>
        <button className="ag-btn ag-btn--ghost" onClick={anotherTeam}><IconSwap size={15} /> {sport === 'soccer' ? (squad.pool === 'alltime' ? 'CHANGE NATION' : 'CHANGE CLUB') : 'CHANGE TEAM'}</button>
      </>
    )
  } else {
    body = editing
      ? <RunItBack sport={sport} squad={squad} owner={owner} renderPicker={renderPicker} onApply={apply} onCancel={() => setEditing(false)} />
      : (
        <>
          <Result sport={sport} squad={squad} owner={owner} reveal={playing != null && playing === squad.last?.at} onRevealed={revealed} />
          {!(playing != null && playing === squad.last?.at) && <>
          <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" onClick={() => { setEditing(true); sfx('tap') }}>RUN IT BACK <IconArrow size={16} /></button>
          <button className="ag-btn ag-btn--ghost" onClick={anotherTeam}><IconSwap size={15} /> RUN IT BACK WITH ANOTHER {sport === 'soccer' ? (squad.pool === 'alltime' ? 'NATION' : 'CLUB') : 'TEAM'}</button>
          <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmNew(true)}>NEW SQUAD</button>
          {squad.seasons.length > 1 && (
            <section className="tk-runs ag-pop" style={{ '--d': '160ms' }}>
              <div className="ag-card-head"><span className="ag-eyebrow">THIS SQUAD'S RUNS{squad.pool === 'alltime' && (sport === 'nfl' || sport === 'bucket') ? ' · ALL-TIME' : ''}</span></div>
              <div className="tk-runs-stats">
                <span><b>{squad.seasons.length}</b><small>RUNS</small></span>
                <span><b>{squad.seasons.reduce((a, s) => a + s.wins, 0)}</b><small>WINS</small></span>
                <span><b>{squad.seasons.filter(s => s.playoffs).length}</b><small>{sport === 'soccer' ? (squad.pool === 'alltime' ? 'KNOCKOUTS' : 'TOP FOUR') : sport === 'baseball' ? 'OCTOBERS' : 'PLAYOFFS'}</small></span>
                <span><b>{sport === 'soccer' ? squad.seasons.reduce((a, s) => a + (s.trophies?.length ?? (s.champion ? 1 : 0)), 0) : squad.seasons.filter(s => s.champion).length}</b><small>{sport === 'soccer' ? 'TROPHIES' : 'TITLES'}</small></span>
              </div>
              {[...squad.seasons].reverse().map((s, i) => (
                <div key={s.n ?? i} className={`tk-run${s.champion ? ' is-won' : ''}`}>
                  <span className="tk-run-pos sq-run-logo">{sport === 'soccer' ? <TeamCrest sport={sport} short={s.team} pool={s.pool} /> : <img src={logoOf(sport, s.team)} alt="" />}</span>
                  <span className="tk-run-txt">
                    <b>{teamOf(sport, s.team, s.pool)?.name ?? s.team}</b>
                    <small>{sport === 'soccer' ? runLine(s) : sport === 'baseball' ? (s.champion ? 'World Series Champions' : s.playoffs ? 'Postseason' : 'No postseason') : s.champion ? 'Champions' : s.playoffs ? 'Playoffs' : 'No playoffs'} · {s.size} {s.size === 1 ? 'build' : 'builds'}{s.awards?.length ? ` · ${s.awards.join(', ')}` : ''}{s.sandbox ? ' · SANDBOX' : ''}</small>
                  </span>
                  <span className="tk-run-ovr"><b>{sport === 'soccer' ? `${s.wins}-${s.draws ?? 0}-${s.losses}` : `${s.wins}-${s.losses}`}</b><small>RECORD</small></span>
                </div>
              ))}
            </section>
          )}
          </>}
        </>
      )
  }

  const kicker = phase === 'pick' ? `ONE SEASON · ${owner.toUpperCase()}'S SQUAD`
    : phase === 'build' ? `BUILDING · ${squad.slots.filter(s => s.build).length} OF ${squad.slots.length}`
    : phase === 'team' ? (sport === 'soccer' ? (squad.pool === 'alltime' ? 'PICK A NATION' : 'PICK A CLUB') : 'PICK A TEAM')
    : phase === 'ready' ? (sport === 'bucket' || sport === 'baseball' ? 'SET THE LINEUP' : sport === 'soccer' ? 'THE FRONT LINE' : 'THE DEPTH CHART')
    : editing ? 'RUN IT BACK' : `${owner.toUpperCase()}'S SQUAD`
  return (
    <div className={`ag-screen ag-screen--${sport} sq`}>
      <Head kicker={kicker} title={editing ? 'Run it back' : 'Squad Builder'} right={exit} />
      <div className="ag-screen-body">{needLegends && !legendsReady(sport) ? <SkRows n={6} rank={false} value={false} label="Loading the legends" /> : body}</div>
      {ring && (() => {
        const last = ring.rounds[ring.rounds.length - 1]
        // (baseball: the World Series, and the Commissioner's Trophy drawn: TrophyArt's, in the baseball chunk)
        const score = sport === 'bucket' ? `${last?.wins ?? 4}–${last?.losses ?? 0} in the NBA Finals` : sport === 'baseball' ? `${last?.wins ?? 4}–${last?.losses ?? 0} over ${teamOf(sport, last?.opp)?.name ?? last?.opp} in the World Series` : `${last?.mySc}–${last?.oppSc}${last?.overtime ? ' OT' : ''} vs ${last?.opponent}`
        return <RingCeremony team={teamOf(sport, ring.team)} title={sport === 'bucket' ? 'NBA Champions' : sport === 'baseball' ? 'World Series Champions' : 'Super Bowl Champions'} score={score}
          trophy={sport === 'bucket' ? '/trophybasketball.webp' : undefined} art={sport === 'baseball' ? <Suspense fallback={<span className="ag-ring-trophy sqb-ring-art" />}><BaseballTrophy /></Suspense> : null} onClose={() => setRing(null)} />
      })()}
      {confirmNew && createPortal(
        <div className="ll-overlay" onClick={e => e.target === e.currentTarget && setConfirmNew(false)}>
          <div className="ll-sheet" role="dialog" aria-modal="true" aria-labelledby="sq-new-title">
            <div className="ll-head"><span className="ag-eyebrow">ONE SQUAD AT A TIME</span><button className="ag-round-btn" onClick={() => setConfirmNew(false)} aria-label="Close"><IconClose size={15} /></button></div>
            <h2 className="ll-title" id="sq-new-title">Start a new squad?</h2>
            <p className="ll-body">This squad, its builds and its seasons go for good. XP, coins and trophies stay.</p>
            <div className="ll-actions">
              <button className="ag-btn ag-cta" onClick={startOver}><IconCheck size={16} /> NEW SQUAD</button>
              <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmNew(false)}>KEEP THIS ONE</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
