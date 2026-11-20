import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createNbaFranchise, loadNba, saveNba, saveNbaSetup, clearNba, rawNbaSlot, nbaSlotSummary, TEAM, recText, records, seasonText } from '../../../lib/franchise2/nba'
import { NBA_FRANCHISE_CARD_KEY } from '../../../lib/franchiseLive'
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
const newSeed = () => `${Date.now().toString(36)}${Math.floor(performance.now() * 1000).toString(36)}`
const PHASE = { season: 'REGULAR SEASON', post: 'REGULAR SEASON OVER', playin: 'PLAY-IN', playoffs: 'PLAYOFFS', done: 'SEASON OVER', off: 'OFFSEASON' }
const LG = { summary: nbaSlotSummary, clear: i => { clearNba(i); try { if (JSON.parse(localStorage.getItem(NBA_FRANCHISE_CARD_KEY))?.slot === i) localStorage.removeItem(NBA_FRANCHISE_CARD_KEY) } catch {} }, TEAM, where: s => `${seasonText(s.year)} · ${s.rec} · ${PHASE[s.phase] ?? ''}${s.rings ? ` · ${s.rings} RING${s.rings > 1 ? 'S' : ''}` : ''}` }

function leaveNote(F) {
  try {
    const t = TEAM[F.team], r = records(F)[F.team]
    localStorage.setItem(NBA_FRANCHISE_CARD_KEY, JSON.stringify({ slot: F.slot, team: F.team, color: t.color, line: `${t.nick} ${recText(r)} · ${PHASE[F.phase] === 'REGULAR SEASON' ? seasonText(F.year) : (PHASE[F.phase] ?? '').toLowerCase().replace(/^\w/, c => c.toUpperCase())}` }))
  } catch {}
}

export default function NbaFranchise({ user, onHome, onBuild, built, onBuiltTaken }) {
  const owner = getUsername(user) || 'Guest'
  // the kit draws the NBA's teams while the mode is open (and football's again when it closes)
  useState(() => setKitLeague(TEAM))
  useEffect(() => { setKitLeague(TEAM); return () => setKitLeague(null) }, [])
  // (back from the build page: straight into the setup that sent him there; the trip is marked for this tab)
  const [slot, setSlot] = useState(() => { try { const t = sessionStorage.getItem(TRIP); return t != null ? Number(t) : null } catch { return null } })
  const slotRef = useRef(slot)
  slotRef.current = slot
  useEffect(() => { try { sessionStorage.removeItem(TRIP) } catch {} }, [])
  const [F, setF] = useState(null)
  const [setup, setSetup] = useState(() => (slot != null ? rawNbaSlot(slot)?.setup ?? null : null))
  const [, bump] = useState(0)
  const Fr = useRef(F); Fr.current = F
  const pend = useRef(null)
  const flush = useCallback(() => { const X = pend.current; if (!X) return; pend.current = null; saveNba(X); leaveNote(X) }, [])
  // every change is saved once it's on screen (changes in a row are one write); leaving writes it straight away
  const act = useCallback(fn => {
    const X = Fr.current
    if (!X) return
    const out = fn(X)
    if (!pend.current) requestAnimationFrame(() => setTimeout(flush, 0))
    pend.current = X
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
    const S = setup ?? (slotRef.current != null ? rawNbaSlot(slotRef.current)?.setup : null)
    if (S && built.id) {
      const was = S.builds?.[built.id]
      putSetup({ ...S, step: 'builds', naming: built.id, builds: { ...S.builds, [built.id]: { ...(was?.name && { name: was.name, num: was.num }), ...(was?.face && { face: was.face }), pos: built.pos, build: built.build, types: built.types, sandbox: !!built.sandbox } } })
      if (slot == null) setSlot(slotRef.current)
      sfx('claim'); haptic('success')
    }
    onBuiltTaken?.()
  }, [built]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildOut = useCallback(job => { flush(); try { sessionStorage.setItem(TRIP, String(setup?.slot ?? slot ?? 0)) } catch {} ; onBuild?.(job) }, [onBuild, flush, setup, slot])
  const open = s => {
    flush()
    try { localStorage.setItem(LAST, String(s)) } catch {}
    const X = loadNba(s)
    setSlot(s); setF(X); setSetup(X ? null : rawNbaSlot(s)?.setup ?? { slot: s, seed: newSeed(), owner, step: 'team' })
    sfx('tap')
  }
  const start = () => {
    const S = setup
    const builds = (S.picks ?? []).map(p => S.builds?.[p.id]).filter(B => B?.name)
    const X = createNbaFranchise({ seed: S.seed, team: S.team, slot: S.slot, owner, rules: S.rules ?? { cap: true, inj: true }, moments: S.games ?? 'advanced', builds })
    saveNba(X); leaveNote(X)
    setF(X); setSetup(null)
    sfx('whistle'); haptic('medium')
  }
  const toSlots = () => { flush(); setSlot(null); setF(null); setSetup(null) }
  const remove = () => { pend.current = null; LG.clear(F?.slot ?? slot); toSlots() }

  if (slot == null || (!F && !setup)) return <Slots owner={owner} onOpen={open} onHome={onHome} lg={LG} />
  if (!F) return <NbaSetup setup={setup} owner={owner} put={putSetup} onStart={start} onBack={toSlots} onBuild={buildOut} />
  return <Suspense fallback={<div className="ag-screen fk fk-root fh" />}><NbaHub F={F} act={act} owner={owner} onHome={() => { flush(); onHome?.() }} onSlots={toSlots} onDelete={remove} /></Suspense>
}
