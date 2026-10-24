import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { POSITIONS, POS_LABEL, POS_NAME, SPOTS, countOf, canAdd, spotsOf, nextToBuild, newSquad, addSlots, dropSlot, isFull, fullSize, afterBuilding } from '../../lib/squad'
import { runSquadSeason, lineupOf, squadStrength, teamOf, logoOf, ovrOf, nameOf, faceOf } from '../../lib/squadSeason'
import { WeekStrip, Bracket, RingCeremony, SeasonRewards } from './AppSeason'
import { useRailOn } from '../../lib/ads'
import { sfx, haptic, victory } from '../../lib/juice'
import { getUsername } from '../../lib/discord'
import { IconClose, IconArrow, IconTrophy, IconCheck, IconSwap, IconPlay } from './icons'

// SQUAD BUILDER (football and basketball): pick the positions (basketball: the
// spots, PG to C), build each one
// (the game's own build pages: the app routes those), pick a real team, set the
// lineup (basketball) and play one season together. Then run it back: add a
// player, cut one, change the team. The squad is lib/squad.js, the season
// lib/squadSeason.js.
//
// `renderPicker(onPick, build)` is the sport's own team picker; `onBuild(squad)`
// sends the app to the build page for the squad's next unbuilt player.

const fmt = v => (typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1)) : v ?? '—')
// the last name (a suffix rides along: Pittman III)
const lastName = n => { const w = (n || '').split(' '); return w.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1] }
const Face = ({ src, name, mine = false, size = 44 }) => (
  <span className={`tk-hs sq-face${mine ? ' is-mine' : ''}`} style={{ width: size, height: size }}>{src ? <img src={src} alt="" loading="lazy" draggable={false} /> : (name || '?').slice(0, 1)}</span>
)

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
            <button className="sq-tile-add" onClick={() => add(pos)} aria-label={`Add a ${POS_NAME[pos]}`}>
              <span className="sq-tile-pos">{POS_LABEL[pos]}</span>
              <span className="sq-tile-name">{hot ? <em>Max amount for position</em> : POS_NAME[pos]}</span>
              <span className="sq-tile-n">{n ? `×${n}` : '+'}</span>
            </button>
            {n > 0 && onRemove && <button className="sq-tile-minus" onClick={() => { onRemove(pos); sfx('back') }} aria-label={`Take a ${POS_NAME[pos]} off`}>−</button>}
          </div>
        )
      })}
    </div>
  )
}

// ── Basketball: the five spots, PG to C, each one once. Tap a spot to fill it,
// tap it again to leave it open; a spot whose player is built shakes (cut them
// from the squad instead). ──
function SpotTiles({ taken, built = [], onAdd, onRemove }) {
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
    <div className="sq-tiles sq-tiles--spots">
      {SPOTS.map((sp, i) => {
        const on = taken.includes(i), hot = held?.i === i
        return (
          <div key={`${i}-${hot ? held.k : 0}`} className={`sq-tile${on ? ' is-on' : ''}${hot ? ' is-max' : ''}`}>
            <button className="sq-tile-add" onClick={() => tap(i)} aria-pressed={on} aria-label={`${sp.name}${on ? ', on the squad' : ''}`}>
              <span className="sq-tile-pos">{sp.label}</span>
              <span className="sq-tile-name">{hot ? <em>Built: cut them above</em> : sp.name}</span>
              <span className="sq-tile-n">{on ? <IconCheck size={16} /> : '+'}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// What a build is called: its position (basketball: its spot, PG to C)
function tagOf(sq, s) {
  const i = sq?.sport === 'bucket' ? spotsOf(sq)[s.id] : null
  return i != null ? SPOTS[i] : { label: POS_LABEL[s.pos], name: POS_NAME[s.pos] }
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
      {render(onPick, merged)}
      {onClose && <button className="ag-round-btn sq-picker-x" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>}
    </div>,
    document.body,
  )
}

// ── Team strength: the real team, and what the builds did to it ─────────────
function Strength({ sport, squad }) {
  const st = useMemo(() => squadStrength(squad), [squad])
  const row = (label, now, was) => {
    const d = Math.round((now - was) * 10) / 10
    return <span className="sq-str-cell"><small>{label}</small><b>{fmt(now)}</b><i className={d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}>{d > 0 ? `+${d}` : d < 0 ? d : '±0'}</i></span>
  }
  return (
    <div className="sq-str">
      {row('OFFENSE', st.off, st.baseOff)}
      {row('DEFENSE', st.def, st.baseDef)}
      <span className="sq-str-note">{sport === 'bucket' ? 'Out of 100' : 'Out of 10'} · your builds against the starters they replace</span>
    </div>
  )
}

// ── Football: the depth chart (who starts, who your builds sent to the bench) ──
function DepthChart({ squad, owner }) {
  const { groups, benched } = useMemo(() => lineupOf(squad), [squad])
  return (
    <section className="sq-depth ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE STARTERS</span></div>
      {POSITIONS.nfl.map(pos => (
        <div key={pos} className="sq-depth-grp">
          <span className="sq-depth-pos">{POS_LABEL[pos]}</span>
          <div className="sq-depth-list">
            {groups[pos].map((x, i) => x.you
              ? <span key={x.you.id} className="sq-chip is-mine"><Face src={faceOf(x.you.build)} name={POS_LABEL[pos]} mine size={30} /><b>{nameOf(pos, x.you.build)}</b><small>{ovrOf(pos, x.you.build)} · {owner}</small></span>
              : <span key={x.real.name + i} className="sq-chip"><Face src={x.real.photo} name={x.real.name} size={30} /><b>{lastName(x.real.name)}</b><small>{x.real.ovr}</small></span>)}
            {benched[pos].length > 0 && <span className="sq-bench">To the bench: {benched[pos].map(p => lastName(p.name)).join(', ')}</span>}
          </div>
        </div>
      ))}
    </section>
  )
}

// ── Basketball: the lineup board. Each build starts at the spot it was picked
// for; drag it to another (guards 1–3, bigs 4–5), or tap it and tap the spot.
// The team's real starters fill the rest. ──
const SPOT_XY = [[50, 17], [17, 42], [83, 42], [30, 75], [70, 75]]
function LineupBoard({ squad, setSquad, owner }) {
  const { spots } = useMemo(() => lineupOf(squad), [squad])
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
      <div className="ag-card-head"><span className="ag-eyebrow">THE LINEUP · DRAG YOUR BUILDS</span></div>
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
              <small className="sq-spot-ovr">{mine ? `${ovrOf(s.pos, s.build)} · ${owner}` : x?.real?.ovr ?? ''}</small>
            </div>
          )
        })}
        {drag?.moved && box && (() => {
          const s = squad.slots.find(q => q.id === drag.id)
          return <span className="sq-ghost" style={{ left: drag.x - box.left, top: drag.y - box.top }}><Face src={faceOf(s?.build)} name={POS_LABEL[s?.pos]} mine size={56} /></span>
        })()}
      </div>
      <p className="sq-board-note">{sel ? 'Now tap the spot to move them to.' : 'The 1, 2 and 3 can swap; so can the 4 and 5. The point and the four run the offense.'}</p>
    </section>
  )
}

// ── The season's result ──────────────────────────────────────────────────────
function outcome(r) {
  if (r.sport === 'bucket') {
    if (r.champion) return 'NBA Champions'
    const last = r.rounds[r.rounds.length - 1]
    if (!r.rounds.length) return `Missed the playoffs · ${r.seed}th in the ${r.conference === 'east' ? 'East' : 'West'}`
    if (last.type === 'playin' && !last.won) return 'Out in the Play-In'
    return `Lost in the ${last.name ?? 'playoffs'}${last.opponent ? ` to ${last.opponent}` : ''}${last.wins != null ? ` (${last.wins}-${last.losses})` : ''}`
  }
  if (r.champion) return 'Super Bowl Champions'
  if (!r.playoffs) return 'Missed the playoffs'
  const last = r.rounds[r.rounds.length - 1]
  return `Lost in the ${last?.round ?? 'playoffs'}${last ? ` to the ${lastName(last.opponent)}` : ''}`
}
function SeasonLines({ r, squad, owner }) {
  const bySlot = Object.fromEntries(squad.slots.map(s => [s.id, s]))
  return (
    <section className="sq-lines ag-pop" style={{ '--d': '120ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE SQUAD'S NUMBERS</span></div>
      {r.lines.map(l => (
        <div key={l.id} className={`sq-line${l.award?.won ? ' is-award' : ''}`}>
          <div className="sq-line-top">
            <Face src={l.face} name={POS_LABEL[l.pos]} mine />
            <span className="sq-row-txt">
              <b>{l.name ?? POS_NAME[l.pos]}</b>
              <small>{SPOTS[l.spot]?.label ?? POS_LABEL[l.pos]} · {owner}{bySlot[l.id] ? '' : ' · cut'}</small>
            </span>
            {l.award?.won && <span className="sq-award"><IconTrophy size={13} /> {l.award.name}</span>}
            <span className="sq-ovr"><b>{l.ovr}</b><small>OVR</small></span>
          </div>
          <div className="sq-stats">{l.stats.map(([k, v]) => <span key={k}><b>{fmt(v)}</b><small>{k}</small></span>)}</div>
        </div>
      ))}
    </section>
  )
}
function Result({ sport, squad, owner }) {
  const r = squad.last
  const team = teamOf(sport, r.team)
  return (
    <>
      <div className={`sq-hero ag-pop${r.champion ? ' is-champ' : ''}`} style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
        <img className="sq-hero-logo" src={logoOf(sport, r.team)} alt="" />
        <span className="sq-hero-txt">
          <span className="ag-eyebrow">SEASON {r.n} · {team?.name ?? r.team}</span>
          <b className="sq-hero-rec">{r.wins}<i>–</i>{r.losses}</b>
          <small className="sq-hero-out">{r.champion && <IconTrophy size={14} />} {outcome(r)}</small>
        </span>
      </div>
      {r.sandbox && <p className="sq-note">SANDBOX squad: just for fun, no XP or coins.</p>}
      {sport === 'bucket' ? (
        <section className="sq-po ag-pop" style={{ '--d': '60ms' }}>
          <div className="sq-log" aria-label={`${r.wins} wins, ${r.losses} losses`}>{r.log.split('').map((c, i) => <i key={i} className={c === 'W' ? 'is-w' : 'is-l'} />)}</div>
          {r.rounds.length > 0 && r.rounds.map((x, i) => (
            <div key={i} className={`sq-po-row${x.won ? ' is-w' : ' is-l'}`}>
              <span>{x.type === 'playin' ? 'PLAY-IN' : (x.name ?? '').toUpperCase()}</span>
              {x.opponent && <img src={logoOf('bucket', x.opponent)} alt="" />}
              <b>{x.type === 'playin' ? (x.won ? 'IN' : 'OUT') : `${x.wins}-${x.losses}`}</b>
            </div>
          ))}
        </section>
      ) : (
        <section className="sq-po ag-pop" style={{ '--d': '60ms' }}>
          <WeekStrip games={r.games} revealed={r.games.length} />
          {r.playoffs && <Bracket rounds={r.rounds} gameIdx={r.rounds.length - 1} status={r.champion ? 'champion' : 'eliminated'} hasBye={r.hasBye} />}
        </section>
      )}
      <SeasonLines r={r} squad={squad} owner={owner} />
      <SeasonRewards result={r} />
    </>
  )
}

// ── Run it back: add a player, cut one, change the team ─────────────────────
function RunItBack({ sport, squad, owner, renderPicker, onApply, onCancel }) {
  const [draft, setDraft] = useState(squad)
  const [picking, setPicking] = useState(false)
  const built = draft.slots.filter(s => s.build).length
  const toBuild = draft.slots.filter(s => !s.build).length
  const team = teamOf(sport, draft.team)
  const removePos = pos => { const s = [...draft.slots].reverse().find(x => x.pos === pos && !x.build); if (s) setDraft(dropSlot(draft, s.id)) }
  const at = sport === 'bucket' ? spotsOf(draft) : {}
  const removeSpot = i => { const s = draft.slots.find(x => at[x.id] === i && !x.build); if (s) setDraft(dropSlot(draft, s.id)) }
  return (
    <>
      <section className="sq-edit ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">THE SQUAD · {draft.slots.length} OF {fullSize(sport)}</span></div>
        {draft.slots.map(s => <BuildRow key={s.id} sq={draft} s={s} owner={owner} onDrop={draft.slots.length > 1 ? () => { setDraft(dropSlot(draft, s.id)); sfx('back') } : null} />)}
      </section>
      <section className="sq-edit ag-pop" style={{ '--d': '60ms' }}>
        <div className="ag-card-head"><span className="ag-eyebrow">ADD A PLAYER</span></div>
        {sport === 'bucket'
          ? <SpotTiles taken={Object.values(at)} built={draft.slots.filter(s => s.build).map(s => at[s.id])} onAdd={i => setDraft(addSlots(draft, [i]))} onRemove={removeSpot} />
          : <PosTiles sport={sport} slots={draft.slots} onAdd={pos => setDraft(addSlots(draft, [pos]))} onRemove={draft.slots.some(s => !s.build) ? removePos : null} />}
      </section>
      <section className="sq-edit sq-edit-team ag-pop" style={{ '--d': '90ms' }}>
        <img src={logoOf(sport, draft.team)} alt="" />
        <span className="sq-row-txt"><b>{team?.name ?? draft.team}</b><small>{draft.team === squad.team ? 'Same team' : `New team (was ${squad.team})`}</small></span>
        <button className="ag-btn ag-btn--ghost sq-team-btn" onClick={() => { setPicking(true); sfx('tap') }}><IconSwap size={15} /> CHANGE TEAM</button>
      </section>
      <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '120ms' }} disabled={!draft.slots.length || !built && !toBuild}
        onClick={() => onApply(draft)}>
        {toBuild ? `BUILD ${toBuild} NEW ${toBuild === 1 ? 'PLAYER' : 'PLAYERS'}` : `SEASON ${(squad.seasons?.length ?? 0) + 1}: ${sport === 'bucket' ? 'SET THE LINEUP' : 'SEE THE STARTERS'}`} <IconArrow size={16} />
      </button>
      <button className="ag-btn ag-btn--ghost" onClick={onCancel}>BACK TO THE RESULTS</button>
      {picking && <Picker render={renderPicker} squad={draft} onPick={t => { setDraft({ ...draft, team: t.short }); setPicking(false) }} onClose={() => setPicking(false)} />}
    </>
  )
}

// ── The screen ───────────────────────────────────────────────────────────────
export default function AppSquad({ sport, squad, setSquad, user, renderPicker, onBuild, onExit }) {
  const owner = user ? (getUsername(user) || 'Player') : 'Guest'
  const [picks, setPicks] = useState([])            // a new squad's positions (basketball: spots), before it starts
  const [editing, setEditing] = useState(false)     // run it back
  const [confirmNew, setConfirmNew] = useState(false)
  const [ring, setRing] = useState(null)
  const [pickOpen, setPickOpen] = useState(true)     // the team picker, open as the team step starts
  const phase = !squad ? 'pick' : squad.phase
  useRailOn(`${phase}|${editing}|${squad?.seasons?.length ?? 0}`)   // a new screen or result brings the bottom rail back
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('.sq')?.scrollTo({ top: 0, behavior: 'instant' }) }, [phase, editing])
  useEffect(() => { if (phase === 'team') setPickOpen(true) }, [phase])

  const start = () => {
    const sq = newSquad({ sport, uid: user?.id ?? null, picks })
    setPicks([]); setSquad(sq); sfx('confirm'); onBuild(sq)
  }
  const startOver = () => { setConfirmNew(false); setEditing(false); setSquad(null); sfx('back') }
  const sim = () => {
    const r = runSquadSeason(squad)
    const seasons = [...(squad.seasons ?? []), { n: r.n, team: r.team, wins: r.wins, losses: r.losses, playoffs: r.playoffs, champion: r.champion, awards: r.lines.filter(l => l.award?.won).map(l => l.award.name), size: r.size, sandbox: r.sandbox, at: r.at }]
    setSquad({ ...squad, last: r, seasons, phase: 'result' })
    // a season like any other: XP, coins, missions (lib/progress.js onSeason); sandbox pays nothing
    const won = r.lines.find(l => l.award?.won)
    window.dispatchEvent(new CustomEvent('bap:season', { detail: {
      sport: sport === 'bucket' ? 'bucket' : 'nfl', pos: null, mode: 'squad', localOnly: true,
      wins: r.wins, losses: r.losses, playoffs: !!r.playoffs, champion: !!r.champion,
      award: !!won, awardName: won?.award.name, ovr: Math.max(0, ...r.lines.map(l => l.ovr)),
      sandbox: !!squad.sandbox, full: isFull(squad), ref: r,
    } }))
    if (r.champion) { victory({ big: true }); setRing(r) } else sfx(r.playoffs ? 'claim' : 'tap')
  }
  const apply = draft => {
    setEditing(false)
    const next = { ...draft, phase: draft.slots.some(s => !s.build) ? 'build' : 'ready' }
    setSquad(next)
    if (next.phase === 'build') onBuild(next)
  }

  const exit = <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
  const steps = [
    sport === 'bucket' ? ['Pick your spots', 'PG to C: fill one spot or all five.'] : ['Pick your positions', 'QB, RBs, WRs, TEs and DBs: as many as a starting lineup holds.'],
    ['Build each one', 'The normal spins, one player after another.'],
    ['Pick a team', 'Its real roster fills every spot you didn\'t build. Your builds start.'],
    ['Play the season', 'One schedule, one record, a stat line and awards for every build. Then run it back.'],
  ]

  let body
  if (phase === 'pick') {
    body = (
      <>
        <section className="sq-edit ag-pop">
          <div className="ag-card-head"><span className="ag-eyebrow">PICK YOUR SQUAD · {picks.length} {picks.length === 1 ? 'PLAYER' : 'PLAYERS'}</span></div>
          {sport === 'bucket'
            ? <SpotTiles taken={picks} onAdd={i => setPicks(p => [...p, i].sort())} onRemove={i => setPicks(p => p.filter(x => x !== i))} />
            : <PosTiles sport={sport} slots={picks.map(pos => ({ pos }))} onAdd={pos => setPicks(p => [...p, pos])}
              onRemove={pos => setPicks(p => { const i = p.lastIndexOf(pos); return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)] })} />}
        </section>
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '60ms' }} disabled={!picks.length} onClick={start}>
          {picks.length ? `BUILD ${picks.length} ${picks.length === 1 ? 'PLAYER' : 'PLAYERS'}` : sport === 'bucket' ? 'PICK A SPOT' : 'PICK A POSITION'} <IconArrow size={16} />
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
          ? <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '60ms' }} onClick={() => { sfx('confirm'); onBuild(squad) }}>BUILD YOUR {sport === 'bucket' ? tagOf(squad, next).name.toUpperCase() : POS_LABEL[next.pos]} <IconArrow size={16} /></button>
          : <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" onClick={() => setSquad({ ...squad, phase: afterBuilding(squad) })}>NEXT <IconArrow size={16} /></button>}
        <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmNew(true)}>NEW SQUAD</button>
      </>
    )
  } else if (phase === 'team') {
    body = (
      <>
        <section className="sq-edit ag-pop">
          <div className="ag-card-head"><span className="ag-eyebrow">YOUR BUILDS · {squad.slots.length}</span></div>
          {squad.slots.map(s => <BuildRow key={s.id} sq={squad} s={s} owner={owner} />)}
        </section>
        <p className="sq-note">Pick a team: its real roster fills every spot you didn't build, and your builds take the starting jobs.</p>
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '60ms' }} onClick={() => { setPickOpen(true); sfx('tap') }}>PICK A TEAM <IconArrow size={16} /></button>
        {squad.team && <button className="ag-btn ag-btn--ghost" onClick={() => setSquad({ ...squad, phase: 'ready' })}>KEEP THE {squad.team}</button>}
        {pickOpen && <Picker render={renderPicker} squad={squad} onPick={t => { setPickOpen(false); setSquad({ ...squad, team: t.short, phase: 'ready' }) }} onClose={() => setPickOpen(false)} />}
      </>
    )
  } else if (phase === 'ready' || (phase === 'result' && !squad.last)) {
    const team = teamOf(sport, squad.team)
    const n = (squad.seasons?.length ?? 0) + 1
    body = (
      <>
        <div className="sq-hero ag-pop" style={{ '--tc': team?.color ?? 'var(--ag-a1)' }}>
          <img className="sq-hero-logo" src={logoOf(sport, squad.team)} alt="" />
          <span className="sq-hero-txt">
            <span className="ag-eyebrow">SEASON {n} · {squad.slots.length} {squad.slots.length === 1 ? 'BUILD' : 'BUILDS'}</span>
            <b className="sq-hero-team">{team?.name ?? squad.team}</b>
          </span>
        </div>
        <Strength sport={sport} squad={squad} />
        {sport === 'bucket' ? <LineupBoard squad={squad} setSquad={setSquad} owner={owner} /> : <DepthChart squad={squad} owner={owner} />}
        <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" style={{ '--d': '120ms' }} onClick={sim}><IconPlay size={16} /> SIM SEASON {n}</button>
        <button className="ag-btn ag-btn--ghost" onClick={() => setSquad({ ...squad, phase: 'team' })}><IconSwap size={15} /> CHANGE TEAM</button>
      </>
    )
  } else {
    body = editing
      ? <RunItBack sport={sport} squad={squad} owner={owner} renderPicker={renderPicker} onApply={apply} onCancel={() => setEditing(false)} />
      : (
        <>
          <Result sport={sport} squad={squad} owner={owner} />
          <button className="ag-btn ag-btn--gold tk-intro-go ag-pop" onClick={() => { setEditing(true); sfx('tap') }}>RUN IT BACK <IconArrow size={16} /></button>
          <button className="ag-btn ag-btn--ghost" onClick={() => setConfirmNew(true)}>NEW SQUAD</button>
          {squad.seasons.length > 1 && (
            <section className="tk-runs ag-pop" style={{ '--d': '160ms' }}>
              <div className="ag-card-head"><span className="ag-eyebrow">THIS SQUAD'S SEASONS</span></div>
              <div className="tk-runs-stats">
                <span><b>{squad.seasons.length}</b><small>SEASONS</small></span>
                <span><b>{squad.seasons.reduce((a, s) => a + s.wins, 0)}</b><small>WINS</small></span>
                <span><b>{squad.seasons.filter(s => s.playoffs).length}</b><small>PLAYOFFS</small></span>
                <span><b>{squad.seasons.filter(s => s.champion).length}</b><small>TITLES</small></span>
              </div>
              {[...squad.seasons].reverse().map(s => (
                <div key={s.n} className={`tk-run${s.champion ? ' is-won' : ''}`}>
                  <span className="tk-run-pos sq-run-logo"><img src={logoOf(sport, s.team)} alt="" /></span>
                  <span className="tk-run-txt">
                    <b>{s.champion ? <><IconTrophy size={13} /> Champions</> : s.playoffs ? 'Playoffs' : 'No playoffs'}</b>
                    <small>Season {s.n} · {s.team} · {s.size} {s.size === 1 ? 'build' : 'builds'}{s.awards?.length ? ` · ${s.awards.join(', ')}` : ''}{s.sandbox ? ' · SANDBOX' : ''}</small>
                  </span>
                  <span className="tk-run-ovr"><b>{s.wins}-{s.losses}</b><small>RECORD</small></span>
                </div>
              ))}
            </section>
          )}
        </>
      )
  }

  const kicker = phase === 'pick' ? 'ONE SEASON · YOUR SQUAD'
    : phase === 'build' ? `BUILDING · ${squad.slots.filter(s => s.build).length} OF ${squad.slots.length}`
    : phase === 'team' ? 'PICK A TEAM'
    : phase === 'ready' ? (sport === 'bucket' ? 'SET THE LINEUP' : 'THE DEPTH CHART')
    : editing ? `SEASON ${(squad.seasons?.length ?? 0) + 1}` : `${owner.toUpperCase()}'S SQUAD`
  return (
    <div className={`ag-screen ag-screen--${sport} sq`}>
      <Head kicker={kicker} title={editing ? 'Run it back' : 'Squad Builder'} right={exit} />
      <div className="ag-screen-body">{body}</div>
      {ring && (() => {
        const last = ring.rounds[ring.rounds.length - 1]
        const score = sport === 'bucket' ? `${last?.wins ?? 4}–${last?.losses ?? 0} in the NBA Finals` : `${last?.mySc}–${last?.oppSc}${last?.overtime ? ' OT' : ''} vs ${last?.opponent}`
        return <RingCeremony team={teamOf(sport, ring.team)} title={sport === 'bucket' ? 'NBA Champions' : 'Super Bowl Champions'} score={score}
          trophy={sport === 'bucket' ? '/trophybasketball.webp' : undefined} onClose={() => setRing(null)} />
      })()}
      {confirmNew && createPortal(
        <div className="ll-overlay" onClick={e => e.target === e.currentTarget && setConfirmNew(false)}>
          <div className="ll-sheet" role="dialog" aria-modal="true" aria-labelledby="sq-new-title">
            <div className="ll-head"><span className="ag-eyebrow">ONE SQUAD AT A TIME</span><button className="ag-round-btn" onClick={() => setConfirmNew(false)} aria-label="Close"><IconClose size={15} /></button></div>
            <h2 className="ll-title" id="sq-new-title">Start a new squad?</h2>
            <p className="ll-body">This squad, its builds and its seasons go for good. Your XP, coins and trophies stay.</p>
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
