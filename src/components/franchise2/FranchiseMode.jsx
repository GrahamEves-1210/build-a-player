import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createFranchise, loadFranchise, saveFranchise, saveSetup, clearFranchise, SLOTS_N, TEAM, recText, records, addProspect, finishCoach, POS } from '../../lib/franchise2'
import { FRANCHISE_CARD_KEY } from '../../lib/franchiseLive'
import { getUsername } from '../../lib/discord'
import { sfx, haptic } from '../../lib/juice'
import Setup from './Setup'
import { Slots, ProspectNamer } from './Slots'
import { FranchiseWait } from './FranchiseCard'
import { touch } from './perf'
const Hub = lazy(() => import('./Hub'))   // (the season's screens load once a franchise is open: the slots and the setup don't wait on them)
import './fr2.css'
const KitPage = import.meta.env.DEV ? lazy(() => import('./KitPage')) : null   // (dev only: ?fkit shows the kit)

// FRANCHISE (take two): take over an NFL team, put your own builds on it, and run it season after season.
// This file is the mode's frame: the three save slots, the setup, then the hub. The builds are made on the game's
// own build page (App.jsx: onBuild out, `built` back); everything else is lib/franchise2.
//   props: user, onHome, onBuild(job { id, pos, n, of }), built { id, pos, build, types, sandbox }, onBuiltTaken

const LAST = 'bap_fr2_last'
const readLast = () => { try { const v = Number(localStorage.getItem(LAST)); return Number.isInteger(v) && v >= 0 && v < SLOTS_N ? v : null } catch { return null } }
// FRANCHISE on Home always opens the save slots (owner, 11-14), never straight into the last franchise. The one way
// back into a slot without picking it: coming back from the build page (a setup's build, a Sandbox prospect). The
// mode marks that trip for this tab when it sends a build out (it survives a reload on the build page).
const TRIP = 'bap_fr2_trip'
const tripOut = () => { try { sessionStorage.setItem(TRIP, '1') } catch {} }
const tripBack = () => { try { return sessionStorage.getItem(TRIP) === '1' } catch { return false } }
const tripDone = () => { try { sessionStorage.removeItem(TRIP) } catch {} }
const rawSlot = slot => { try { const s = localStorage.getItem(`bap_fr2_slot_${slot}`); return s ? JSON.parse(s) : null } catch { return null } }
const newSeed = () => `${Date.now().toString(36)}${Math.floor(performance.now() * 1000).toString(36)}`

// Home's card reads this note (lib/franchiseLive.js): the team and where it stands
function leaveNote(F) {
  try {
    const t = TEAM[F.team], r = records(F)[F.team]
    const where = F.phase === 'season' ? `Week ${F.wk + 1}` : F.phase === 'playoffs' ? 'Playoffs' : 'Offseason'
    localStorage.setItem(FRANCHISE_CARD_KEY, JSON.stringify({ slot: F.slot, team: F.team, color: t.color, line: `${t.nick} ${recText(r)} · ${where}` }))
  } catch {}
}

export default function FranchiseMode({ user, onHome, onBuild, built, onBuiltTaken }) {
  const owner = getUsername(user) || 'Guest'
  const [slot, setSlot] = useState(() => { if (!tripBack() && !built) return null; const s = readLast(); return s != null && rawSlot(s) ? s : null })
  useEffect(() => { tripDone() }, [])   // (read once on the way in; StrictMode runs the state's first value twice)
  // the season's screens, fetched while the slots are up (the browser idle), so opening a save rarely waits on them
  useEffect(() => { const go = () => { import('./Hub').catch(() => {}) }; const id = window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 800); return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id)) }, [])
  const [F, setF] = useState(() => (slot != null ? loadFranchise(slot) : null))
  const [setup, setSetup] = useState(() => (slot != null && !F ? rawSlot(slot)?.setup ?? null : null))
  const [, bump] = useState(0)
  const Fr = useRef(F); Fr.current = F

  // every change to the franchise is saved (after every week and every offseason stop). The save itself (the whole
  // league packed, ~150 KB) waits until the change is on screen: a tap answers first, then it's written; changes in
  // a row are one write. Leaving the mode, the page or the tab writes it straight away.
  const pend = useRef(null)
  const flush = useCallback(() => { const X = pend.current; if (!X) return; pend.current = null; saveFranchise(X); leaveNote(X) }, [])
  const act = useCallback(fn => {
    const X = Fr.current
    if (!X) return
    const out = fn(X)
    touch(X)
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
  const buildOut = useCallback(job => { flush(); tripOut(); onBuild?.(job) }, [onBuild, flush])
  const putSetup = useCallback(s => { setSetup(s); if (s) saveSetup(s.slot, s) }, [])

  // a build back from the build page: into the setup (or, a Sandbox prospect, into this year's draft class)
  const took = useRef(null)   // (each build is taken once: StrictMode runs this effect twice in development)
  useEffect(() => {
    if (!built || took.current === built) return
    took.current = built
    if (built.id === 'prospect' && F) {
      // (named next, ProspectNamer: `unnamed` keeps the sheet up through a reload)
      act(X => { const idx = X.builds.length; X.builds.push({ pos: built.pos, build: built.build, types: built.types, num: null, age: 21, car: [], prospect: 1, unnamed: 1 }); X.sandbox = true; addProspect(X, idx) })
      sfx('claim')
    } else if (setup && built.id) {
      // back to the setup on this build's name and number (Setup.jsx NameStep); a rebuilt spot keeps them
      const was = setup.builds?.[built.id]
      putSetup({ ...setup, naming: built.id, builds: { ...setup.builds, [built.id]: { ...(was?.name && { name: was.name, num: was.num }), ...(was?.face && { face: was.face }), pos: built.pos, build: built.build, types: built.types, sandbox: !!built.sandbox } }, sandbox: setup.sandbox || !!built.sandbox })
      sfx('claim'); haptic('success')
    }
    onBuiltTaken?.()
  }, [built]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = s => {
    flush()
    try { localStorage.setItem(LAST, String(s)) } catch {}
    const X = loadFranchise(s)
    setSlot(s); setF(X); setSetup(X ? null : rawSlot(s)?.setup ?? { slot: s, seed: newSeed(), owner, step: 'team', picks: [], builds: {} })
    sfx('tap')
  }
  const start = () => {
    const S = setup
    const c = S.coach ?? {}
    const coach = finishCoach(S.cb, { name: `${c.first ?? ''} ${c.last ?? ''}`.trim() || owner, face: c.face ?? null, style: c.style ?? null })
    // (the builds in the setup's order, position by position: the order their rookie slots were shown in)
    const builds = POS.flatMap(pos => (S.picks ?? []).filter(p => p.pos === pos)).map(p => S.builds[p.id]).filter(Boolean)
    const X = createFranchise({ seed: S.seed, team: S.team, slot: S.slot, owner, sandbox: S.sandbox, coach, builds })
    X.games = S.games ?? 'advanced'
    saveFranchise(X); leaveNote(X)
    setF(X); setSetup(null)
    sfx('whistle'); haptic('medium')
  }
  const toSlots = () => { flush(); try { localStorage.removeItem(LAST) } catch {}; setSlot(null); setF(null); setSetup(null) }
  const remove = () => { pend.current = null; clearFranchise(F?.slot ?? slot); try { localStorage.removeItem(FRANCHISE_CARD_KEY) } catch {}; toSlots() }

  if (KitPage && /[?&]fkit\b/.test(location.search)) return <Suspense fallback={null}><KitPage onHome={onHome} /></Suspense>   // (dev only: the kit, kit.jsx)
  if (slot == null) return <Slots owner={owner} onOpen={open} onHome={onHome} />
  if (!F && setup) return <Setup setup={setup} owner={owner} put={putSetup} onBuild={buildOut} onStart={start} onBack={toSlots} />
  if (!F) return <Slots owner={owner} onOpen={open} onHome={onHome} />
  const naming = F.builds.findIndex(b => b.prospect && b.unnamed)
  if (naming >= 0) return <ProspectNamer F={F} B={F.builds[naming]} owner={owner} onDone={(name, face) => { act(X => { const B = X.builds[naming]; B.name = name; if (face) B.face = face; delete B.unnamed; for (const x of X.dc ?? []) if (x.b === naming) x.n = name }); sfx('claim') }} />
  return <Suspense fallback={<FranchiseWait kind="hub" />}><Hub F={F} act={act} owner={owner} onHome={() => { flush(); onHome?.() }} onSlots={toSlots} onDelete={remove} onBuild={buildOut} /></Suspense>
}
