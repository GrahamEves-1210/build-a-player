import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createNbaFranchise, loadNba, saveNba, saveNbaSetup, clearNba, rawNbaSlot, nbaSlotSummary, NBA_KEY, TEAM, recText, records, seasonText, NC } from '../../../lib/franchise2/nba'
import { NBA_FRANCHISE_CARD_KEY, NBA_FRANCHISE_ART, NBA_FRANCHISE_TURN } from '../../../lib/franchiseLive'
import { getUsername } from '../../../lib/discord'
import { sfx, haptic } from '../../../lib/juice'
import { setKitLeague } from '../kit'
import { Slots } from '../Slots'
import NbaSetup from './NbaSetup'
import '../fr2.css'
import './nba.css'
const NbaHub = lazy(() => import('./NbaHub'))

// BASKETBALL FRANCHISE: take over an NBA team as its general manager and run it season after season. The same frame
// as football's (FranchiseMode.jsx): three save slots (their own keys), the setup, then the hub. The engine is
// lib/franchise2/nba; the kit (kit.jsx) draws the NBA's teams while this is open.
//   props: user, onHome
const LAST = 'bap_frnba_last'
const TRIP = 'bap_frnba_trip'
const MOMENT = 'bap_frnba_moment'   // (a key moment's mini game was open when the tab reloaded, NbaGame.jsx: straight back to that franchise)
const newSeed = () => `${Date.now().toString(36)}${Math.floor(performance.now() * 1000).toString(36)}`
const PHASE = { season: 'REGULAR SEASON', post: 'REGULAR SEASON OVER', playin: 'PLAY-IN', playoffs: 'PLAYOFFS', done: 'SEASON OVER', off: 'OFFSEASON' }
const LG = { art: NBA_FRANCHISE_ART, turn: NBA_FRANCHISE_TURN, key: NBA_KEY, summary: nbaSlotSummary, clear: i => { clearNba(i); try { if (JSON.parse(localStorage.getItem(NBA_FRANCHISE_CARD_KEY))?.slot === i) localStorage.removeItem(NBA_FRANCHISE_CARD_KEY) } catch {} }, TEAM, where: s => `${seasonText(s.year)} · ${s.rec} · ${PHASE[s.phase] ?? ''}${s.rings ? ` · ${s.rings} RING${s.rings > 1 ? 'S' : ''}` : ''}${s.light ? ' · LIGHT' : ''}` }

function leaveNote(F) {
  try {
    const t = TEAM[F.team], r = records(F)[F.team]
    localStorage.setItem(NBA_FRANCHISE_CARD_KEY, JSON.stringify({ slot: F.slot, team: F.team, color: t.color, line: `${t.nick} ${recText(r)} · ${PHASE[F.phase] === 'REGULAR SEASON' ? seasonText(F.year) : (PHASE[F.phase] ?? '').toLowerCase().replace(/^\w/, c => c.toUpperCase())}` }))
  } catch {}
}

export default function NbaFranchise({ user, onHome, onBuild, built, onBuiltTaken, onSquad = null }) {
  const owner = getUsername(user) || 'Guest'
  // the kit draws the NBA's teams while the mode is open (and football's again when it closes). Set on every render,
  // not once: a kit reloaded under an open league (the dev server's hot reload) came back on football's teams, and the
  // Hornets (no football CHA) lost their logos
  setKitLeague(TEAM)
  useEffect(() => { setKitLeague(TEAM); return () => setKitLeague(null) }, [])
  // (back from the build page: straight into the setup that sent him there; the trip is marked for this tab)
  const [slot, setSlot] = useState(() => { try { const t = sessionStorage.getItem(TRIP) ?? sessionStorage.getItem(MOMENT); return t != null ? Number(t) : null } catch { return null } })
  const slotRef = useRef(slot)
  slotRef.current = slot
  useEffect(() => { try { sessionStorage.removeItem(TRIP); sessionStorage.removeItem(MOMENT) } catch {} }, [])
  // (and back from the build page with a Sandbox prospect: the league that sent him, TRIP; a setup's slot has none)
  const [F, setF] = useState(() => { try { const m = sessionStorage.getItem(MOMENT) ?? sessionStorage.getItem(TRIP); return m != null ? loadNba(Number(m)) : null } catch { return null } })
  const [setup, setSetup] = useState(() => (slot != null ? rawNbaSlot(slot)?.setup ?? null : null))
  const [, bump] = useState(0)
  const Fr = useRef(F); Fr.current = F
  const pend = useRef(null)
  // a save that fails (the browser's storage full): the hub says so, and it keeps trying every few seconds and on
  // every change until one goes through
  const [saveBad, setSaveBad] = useState(false)
  const bad = useRef(false)
  const flush = useCallback(() => {
    const X = pend.current
    if (!X) return
    pend.current = null
    const ok = saveNba(X)
    if (ok) leaveNote(X)
    if (ok !== !bad.current) { bad.current = !ok; setSaveBad(!ok) }
  }, [])
  const retry = useCallback(() => { const X = Fr.current; if (!X) return; pend.current = X; flush() }, [flush])
  useEffect(() => { if (!saveBad) return; const t = setInterval(retry, 8000); return () => clearInterval(t) }, [saveBad, retry])
  // every change is saved once it's on screen (changes in a row are one write); leaving writes it straight away
  // { save: false }: on screen but not written yet (a sim to the end writes now and then and once when it stops)
  const sched = useRef(false)
  const act = useCallback((fn, { save = true } = {}) => {
    const X = Fr.current
    if (!X) return
    const out = fn(X)
    pend.current = X
    if (save && !sched.current) { sched.current = true; requestAnimationFrame(() => setTimeout(() => { sched.current = false; flush() }, 0)) }
    bump(n => n + 1)
    return out
  }, [flush])
  useEffect(() => {
    const away = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', away)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', away); flush() }
  }, [flush])
  const putSetup = useCallback(s => { setSetup(s); if (s) saveNbaSetup(s.slot, s) }, [])
  // a build back from the build page: into the setup, on to his name and number (a rebuilt one keeps them)
  const took = useRef(null)
  useEffect(() => {
    if (!built || took.current === built) return
    took.current = built
    // (a Sandbox prospect for this year's class: his name on the draft screen, draft.js addSandboxProspect)
    if (built.id === 'prospect' && Fr.current) {
      act(X => { X.sbp = { pos: built.pos, spot: built.spot ?? null, build: built.build, types: built.types ?? null } })
      sfx('claim'); haptic('success')
      onBuiltTaken?.()
      return
    }
    const S = setup ?? (slotRef.current != null ? rawNbaSlot(slotRef.current)?.setup : null)
    if (S && built.id) {
      const was = S.builds?.[built.id]
      putSetup({ ...S, step: 'builds', naming: built.id, builds: { ...S.builds, [built.id]: { ...(was?.name && { name: was.name, num: was.num }), ...(was?.face && { face: was.face }), pos: built.pos, build: built.build, types: built.types, sandbox: !!built.sandbox } } })
      if (slot == null) setSlot(slotRef.current)
      sfx('claim'); haptic('success')
    }
    onBuiltTaken?.()
  }, [built]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildOut = useCallback(job => { flush(); try { sessionStorage.setItem(TRIP, String(setup?.slot ?? F?.slot ?? slot ?? 0)) } catch {} ; onBuild?.(job) }, [onBuild, flush, setup, slot, F])
  const open = s => {
    flush()
    try { localStorage.setItem(LAST, String(s)) } catch {}
    const X = loadNba(s)
    setSlot(s); setF(X); setSetup(X ? null : rawNbaSlot(s)?.setup ?? { slot: s, seed: newSeed(), owner, step: 'pace' })
    sfx('tap')
  }
  const start = () => {
    const S = setup
    const builds = (S.picks ?? []).map(p => S.builds?.[p.id] && { ...S.builds[p.id], ...(p.spot && { spot: p.spot }) }).filter(B => B?.name)
    // (the coach from the COACH step: coach.js, his staff the team's own; the pick from the MODE step: F.pace)
    const coach = S.cb && NC.linesDone(S.cb) ? NC.finishCoach(S.cb, { name: `${S.coach?.first ?? ''} ${S.coach?.last ?? ''}`.trim() || owner, face: S.coach?.face ?? null, style: S.coach?.style ?? null }) : null
    const X = createNbaFranchise({ seed: S.seed, team: S.team, slot: S.slot, owner, rules: S.rules ?? { cap: true, inj: true }, sandbox: !!S.rules?.sandbox, moments: S.games ?? 'advanced', builds, pace: S.pace ?? 'full', ...(coach && { coach }) })
    if (saveNba(X)) leaveNote(X); else { bad.current = true; setSaveBad(true) }
    setF(X); setSetup(null)
    sfx('whistle'); haptic('medium')
  }
  const toSlots = () => { flush(); setSlot(null); setF(null); setSetup(null) }
  const remove = () => { pend.current = null; LG.clear(F?.slot ?? slot); toSlots() }

  if (slot == null || (!F && !setup)) return <Slots owner={owner} onOpen={open} onHome={onHome} onSquad={onSquad} lg={LG} />
  if (!F) return <NbaSetup setup={setup} owner={owner} put={putSetup} onStart={start} onBack={toSlots} onBuild={buildOut} />
  return <Suspense fallback={<div className="ag-screen fk fk-root fh" />}><NbaHub F={F} act={act} owner={owner} onBuild={buildOut} onHome={() => { flush(); onHome?.() }} onSlots={toSlots} onDelete={remove} saveBad={saveBad} onRetry={retry} /></Suspense>
}
