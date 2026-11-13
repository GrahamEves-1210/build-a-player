import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bug, FrShell } from './frUi'
import { dressFor } from './frTeams'
import { loadEngine, loadSetup, saveSetup, newSetup, isMidSetup, setMidSetup, patchPick, ratingOf, leaveCardNote, dropCardNote } from './frStore'
import FrSetup, { Slots } from './FrSetup'
import FrHub from './FrHub'
import FrTeam from './FrTeam'
import FrLeague from './FrLeague'
import FrOffice from './FrOffice'
import FrWeek from './FrWeek'
import { getUsername } from '../../lib/discord'
import { sfx, haptic } from '../../lib/juice'
import './franchise.css'
import './franchise-screens.css'
import './franchise-wave2.css'

// ── FRANCHISE: a football mode (in SQUAD BUILDER's place on football's Home while lib/franchiseLive.js is on) ──
// Take over an NFL team as its general manager, build the players you want on the game's own build screen (the
// team's real roster fills every other spot), and run it season after season. Everything here, the engine
// (lib/franchise) and the art included, loads only when the mode opens (App.jsx: lazy).
// The look is the mode's own (franchise.css): html.is-fr is on while it's open.
//
// This file is the mode's switchboard: which screen is up, the open franchise (ONE object, `F`: every engine
// action returns the next one, lib/franchise/API.md) and its save.
//   'slots'    the saves (FrSetup.jsx Slots)
//   'setup'    a new franchise, four steps (FrSetup.jsx)
//   'hub'      the franchise: HUB · TEAM · LEAGUE · OFFICE (FrHub, FrTeam, FrLeague, FrOffice). A tab's own
//              views sit behind a slim row inside it; go(tab, { view, … }) lands on one (the hub's THIS WEEK,
//              a player's sheet). say(text) puts a plain line under the scorebug (a refusal is a red one)
//   'gameday'  the GM's game. SEAM: ./gameday/GameDay.jsx (the game day agent's), mounted lazily with
//              { franchise, onFranchise(next), onDone() }. While that file isn't in the tree, PLAY WEEK sims the
//              week through the engine and shows the plain recap ('week').
//   'week'     the week just played, plainly: the final, the box score, the league's scores (FrWeek.jsx)
//   'offseason' SEAM: ./offseason/Offseason.jsx (not built yet), same three props. Until it exists the hub
//              carries a plain panel that moves the offseason on one stage at a time.
// Props from App.jsx: onBuild(job) sends a roster spot to the build screen; `built` is the finished build
// coming back ({ id, pos, build, types }); onBuiltTaken() clears it.

// the kit on one page (dev server only: /?franchise=1&frkit=KC)
const QS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const KIT = import.meta.env.DEV ? QS.get('frkit') : null
const FrKit = KIT != null ? lazy(() => import('./FrKit')) : null
// (dev server only: /?franchise=1&frplain=1 plays the week on the plain recap even when the game day is there)
const PLAIN = import.meta.env.DEV && QS.has('frplain')

const GD = import.meta.glob('./gameday/GameDay.jsx')
const loadGD = GD['./gameday/GameDay.jsx']
const GameDay = loadGD && !PLAIN ? lazy(() => loadGD().then(m => ({ default: m.GameDay ?? m.default }))) : null
const OFF = import.meta.glob('./offseason/Offseason.jsx')
const loadOff = OFF['./offseason/Offseason.jsx']
const Offseason = loadOff ? lazy(() => loadOff().then(m => ({ default: m.Offseason ?? m.default }))) : null

const TABS = [{ id: 'hub', label: 'HUB' }, { id: 'team', label: 'TEAM' }, { id: 'league', label: 'LEAGUE' }, { id: 'office', label: 'OFFICE' }]

export default function FranchiseMode({ user, onHome, onBuild, built = null, onBuiltTaken }) {
  const [FR, setFR] = useState(null)
  const [failed, setFailed] = useState(false)
  const [F, setF] = useState(null)
  const [slot, setSlot] = useState(null)
  const [slots, setSlots] = useState(null)
  const [setup, setSetupState] = useState(loadSetup)
  const [view, setView] = useState(() => ((built || isMidSetup()) && loadSetup() ? 'setup' : 'slots'))
  const [tab, setTab] = useState('hub')
  const [jump, setJump] = useState(null)   // where inside a tab to land: { tab, view, … }
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const owner = getUsername(user) || 'Guest'

  useEffect(() => {
    document.documentElement.classList.add('is-fr')
    return () => { document.documentElement.classList.remove('is-fr'); dressFor(null) }
  }, [])
  useEffect(() => { let live = true; loadEngine().then(m => { if (live) { setFR(m); setSlots(m.listSlots()) } }, () => { if (live) setFailed(true) }); return () => { live = false } }, [])

  const putSetup = useCallback(d => { setSetupState(d); saveSetup(d) }, [])
  // a build coming back from the build screen: into its spot
  useEffect(() => {
    if (!built) return
    const d = loadSetup()
    if (d && built.id && d.picks.some(p => p.id === built.id)) {
      putSetup({ ...patchPick(d, built.id, { build: built.build, types: built.types, ...ratingOf(built.pos, built.build, built.types) }), step: 'builds' })
      setView('setup')
    }
    onBuiltTaken?.()
  }, [built]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMidSetup(view === 'setup') }, [view])

  // ── the open franchise and its save ───────────────────────────────────────
  // (saved a moment after every change, and at once when the mode is left or the page goes away)
  const live = useRef({ F: null, slot: null, FR: null, dirty: false })
  live.current.F = F; live.current.slot = slot; live.current.FR = FR
  const saveT = useRef(0)
  const saveNow = useCallback(() => {
    clearTimeout(saveT.current)
    const { F: f, slot: s, FR: e, dirty } = live.current
    if (!dirty || !f || s == null || !e) return
    live.current.dirty = false
    const r = e.saveFranchise(f, s)
    if (r?.ok) leaveCardNote(e, f, s)
    else if (r?.error) setToast({ text: r.error, bad: true })
  }, [])
  const put = useCallback(next => {
    if (!next) return
    setF(next)
    live.current.F = next; live.current.dirty = true
    clearTimeout(saveT.current); saveT.current = setTimeout(saveNow, 700)
    if (next.flash && next.flash.ok === false && next.flash.msg) { setToast({ text: next.flash.msg, bad: true }); sfx('deny'); haptic('light') }
  }, [saveNow])
  // every engine action goes through here: act(F => FR.setGameplan(F, …))
  const act = useCallback(fn => { const f = live.current.F; if (!f) return null; const next = fn(f); put(next); return next }, [put])
  useEffect(() => {
    const flush = () => saveNow()
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', flush)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); saveNow() }
  }, [saveNow])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3600); return () => clearTimeout(id) }, [toast])

  const team = F?.team ?? null
  // the accent: the open franchise's team; none on the saves screen (the setup dresses itself, and so does the kit)
  useEffect(() => { if (FrKit || view === 'setup') return; dressFor(view === 'slots' ? null : team) }, [team, view])

  const open = s => {
    const f = FR.loadFranchise(s)
    if (!f || f.broken) { setToast({ text: f?.reason ?? 'That save could not be opened.', bad: true }); sfx('deny'); return }
    setF(f); setSlot(s); setTab('hub'); setView('hub'); leaveCardNote(FR, f, s)
  }
  const toSlots = () => { saveNow(); setSlots(FR.listSlots()); setF(null); setSlot(null); setView('slots') }
  // (one setup at a time: with one already under way, another empty slot takes that setup rather than dropping it)
  const startNew = s => { putSetup(setup && (setup.team || setup.picks.length) ? { ...setup, slot: s } : { ...newSetup(s), gmName: owner.slice(0, 18) }); setView('setup') }
  const create = () => {
    if (busy || !setup?.team) return
    setBusy(true); sfx('send'); haptic('medium')
    // (the league takes a moment to build: the button says so first)
    setTimeout(() => {
      try {
        const f = FR.createFranchise({
          team: setup.team, seed: setup.seed, gmName: (setup.gmName || owner).trim() || owner, coach: setup.coach ?? undefined, settings: setup.settings,
          builds: setup.picks.filter(p => p.build).map(p => ({ pos: p.pos, build: p.build, types: p.types, name: p.name.trim() || undefined })),
        })
        const r = FR.saveFranchise(f, setup.slot)
        if (r?.ok === false && r.error) setToast({ text: r.error, bad: true })
        leaveCardNote(FR, f, setup.slot)
        setF(f); setSlot(setup.slot); putSetup(null); setTab('hub'); setView('hub')
      } catch (e) { console.error('[franchise] create failed', e); setToast({ text: 'The league could not be set up. Try again.', bad: true }) }
      setBusy(false)
    }, 60)
  }

  // ── PLAY WEEK ─────────────────────────────────────────────────────────────
  const hub = useMemo(() => (FR && F ? FR.hub(F) : null), [FR, F])
  const playWeek = () => {
    if (!hub) return
    sfx('send'); haptic('medium')
    if (hub.primary?.action === 'stage') { if (Offseason) setView('offseason'); else act(f => FR.advanceStage(f)); return }
    if (hub.primary?.action === 'play' && GameDay) { saveNow(); setView('gameday'); return }
    // no game day in the tree yet, a bye, or a team that's out: the engine plays the week
    // (the league is changed in place: what it was is read before the call)
    const was = `${F.year}-${F.phase}-${F.week}`, next = act(f => FR.advanceWeek(f))
    if (next && `${next.year}-${next.phase}-${next.week}` !== was && FR.lastWeek(next)) setView('week')
  }

  if (FrKit) return <Suspense fallback={<div className="fr" />}><FrKit team={KIT || 'KC'} onHome={onHome} /></Suspense>
  const toastEl = toast && <div className={`fr-toast${toast.bad ? '' : ' is-ok'}`} role="status" onClick={() => setToast(null)}>{toast.text}</div>
  if (!FR || !slots) {
    return (
      <FrShell bug={<Bug title="FRANCHISE" eyebrow="FOOTBALL" onExit={onHome} exit="HOME" />}>
        <div className="fr-page"><p className="fr-empty">{failed ? 'THE FRONT OFFICE DID NOT LOAD. CHECK THE CONNECTION AND OPEN IT AGAIN.' : 'OPENING THE FRONT OFFICE'}</p></div>
      </FrShell>
    )
  }
  if (view === 'setup' && setup) {
    return <>
      <FrSetup FR={FR} setup={setup} onSetup={putSetup} busy={busy} onCreate={create} onLeave={() => { setSlots(FR.listSlots()); setView('slots') }}
        onBuild={job => { setMidSetup(true); onBuild?.(job) }} />
      {toastEl}
    </>
  }
  if (view === 'slots' || !F || !hub) {
    return <>
      <Slots slots={slots} setup={setup} onHome={onHome} onOpen={open} onNew={startNew} onResume={() => setView('setup')}
        onDropSetup={() => putSetup(null)} onDelete={s => { FR.deleteSlot(s); dropCardNote(s); setSlots(FR.listSlots()) }} />
      {toastEl}
    </>
  }
  if (view === 'gameday' && GameDay) {
    return <Suspense fallback={<div className="fr" />}><GameDay franchise={F} onFranchise={put} onDone={() => { saveNow(); setTab('hub'); setView('hub') }} /></Suspense>
  }
  if (view === 'offseason' && Offseason) {
    return <Suspense fallback={<div className="fr" />}><Offseason franchise={F} onFranchise={put} onDone={() => { saveNow(); setTab('hub'); setView('hub') }} /></Suspense>
  }
  if (view === 'week') return <><FrWeek FR={FR} F={F} hub={hub} onDone={() => { setTab('hub'); setView('hub') }} />{toastEl}</>

  const next = hub.next
  const cells = hub.phase === 'offseason'
    ? [{ label: String(hub.year), value: 'OFFSEASON' }, { label: 'LAST SEASON', value: hub.record.text }]
    : [{ label: `${hub.year} ${hub.week <= 18 ? 'WEEK' : 'PLAYOFFS'}`, value: hub.week <= 18 ? String(hub.week) : hub.weekLabel }, { label: 'RECORD', value: hub.record.text },
      { label: 'NEXT', value: hub.bye || !next ? 'BYE' : `${next.home ? 'vs' : '@'} ${next.opp.short}`, logo: hub.bye || !next ? null : next.opp.short }]
  const open_ = hub.tasks?.filter(t => !t.done).length ?? 0
  const go = (t, to = null) => { setJump(to ? { ...to, tab: t } : null); setTab(t) }
  const say = text => { if (text) setToast({ text: String(text), bad: false }) }
  const props = { FR, F, hub, act, go, say, jump: jump?.tab === tab ? jump : null }
  return (
    <>
      <FrShell tab={tab} onTab={t => go(t)} tabs={TABS.map(t => (t.id === 'hub' ? { ...t, n: open_ } : t))}
        bug={<Bug team={hub.team.short} cells={cells} onExit={toSlots} />}
        cta={tab === 'hub' && hub.primary ? <button className="fr-btn" onClick={playWeek}>{hub.primary.label}</button> : null}>
        {tab === 'hub' ? <FrHub {...props} offseasonSeam={!!Offseason} />
          : tab === 'team' ? <FrTeam {...props} />
          : tab === 'league' ? <FrLeague {...props} />
          : <FrOffice {...props} slot={slot} onSlots={toSlots} />}
      </FrShell>
      {toastEl}
    </>
  )
}
