import { useCallback, useEffect, useRef, useState } from 'react'
import { createFranchise, loadFranchise, saveFranchise, saveSetup, clearFranchise, slotSummary, SLOTS_N, TEAM, recText, records, addProspect } from '../../lib/franchise2'
import { FRANCHISE_CARD_KEY } from '../../lib/franchiseLive'
import { getUsername } from '../../lib/discord'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconArrow } from '../app/icons'
import { Logo, teamVars } from './bits'
import Setup from './Setup'
import Hub from './Hub'
import './fr2.css'

// FRANCHISE (take two): take over an NFL team, put your own builds on it, and run it season after season.
// This file is the mode's frame: the three save slots, the setup, then the hub. The builds are made on the game's
// own build page (App.jsx: onBuild out, `built` back); everything else is lib/franchise2.
//   props: user, onHome, onBuild(job { id, pos, n, of }), built { id, pos, build, types, sandbox }, onBuiltTaken

const LAST = 'bap_fr2_last'
const readLast = () => { try { const v = Number(localStorage.getItem(LAST)); return Number.isInteger(v) && v >= 0 && v < SLOTS_N ? v : null } catch { return null } }
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
  const [slot, setSlot] = useState(() => { const s = readLast(); return s != null && rawSlot(s) ? s : null })
  const [F, setF] = useState(() => (slot != null ? loadFranchise(slot) : null))
  const [setup, setSetup] = useState(() => (slot != null && !F ? rawSlot(slot)?.setup ?? null : null))
  const [, bump] = useState(0)
  const Fr = useRef(F); Fr.current = F

  // every change to the franchise is saved (after every week and every offseason stop)
  const act = useCallback(fn => {
    const X = Fr.current
    if (!X) return
    const out = fn(X)
    saveFranchise(X); leaveNote(X)
    bump(n => n + 1)
    return out
  }, [])
  const putSetup = useCallback(s => { setSetup(s); if (s) saveSetup(s.slot, s) }, [])

  // a build back from the build page: into the setup (or, a Sandbox prospect, into this year's draft class)
  useEffect(() => {
    if (!built) return
    if (built.id === 'prospect' && F) {
      act(X => { const idx = X.builds.length; X.builds.push({ pos: built.pos, build: built.build, types: built.types, num: 0, age: 21, car: [], prospect: 1 }); X.sandbox = true; addProspect(X, idx) })
      sfx('claim')
    } else if (setup && built.id) {
      putSetup({ ...setup, builds: { ...setup.builds, [built.id]: { pos: built.pos, build: built.build, types: built.types, sandbox: !!built.sandbox } }, sandbox: setup.sandbox || !!built.sandbox })
      sfx('claim'); haptic('success')
    }
    onBuiltTaken?.()
  }, [built]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = s => {
    try { localStorage.setItem(LAST, String(s)) } catch {}
    const X = loadFranchise(s)
    setSlot(s); setF(X); setSetup(X ? null : rawSlot(s)?.setup ?? { slot: s, seed: newSeed(), owner, step: 'team', picks: [], builds: {} })
    sfx('tap')
  }
  const start = coach => {
    const S = setup
    const X = createFranchise({ seed: S.seed, team: S.team, slot: S.slot, owner, sandbox: S.sandbox, coach, builds: S.picks.map(p => S.builds[p.id]).filter(Boolean) })
    X.games = S.games ?? 'advanced'
    saveFranchise(X); leaveNote(X)
    setF(X); setSetup(null)
    sfx('whistle'); haptic('medium')
  }
  const toSlots = () => { try { localStorage.removeItem(LAST) } catch {}; setSlot(null); setF(null); setSetup(null) }
  const remove = () => { clearFranchise(F?.slot ?? slot); try { localStorage.removeItem(FRANCHISE_CARD_KEY) } catch {}; toSlots() }

  if (slot == null) return <Slots owner={owner} onOpen={open} onHome={onHome} />
  if (!F && setup) return <Setup setup={setup} owner={owner} put={putSetup} onBuild={onBuild} onStart={start} onBack={toSlots} />
  if (!F) return <Slots owner={owner} onOpen={open} onHome={onHome} />
  return <Hub F={F} act={act} owner={owner} onHome={onHome} onSlots={toSlots} onDelete={remove} onBuild={onBuild} />
}

// ── The three slots ──────────────────────────────────────────────────────────
function Slots({ owner, onOpen, onHome }) {
  const rows = Array.from({ length: SLOTS_N }, (_, i) => ({ i, s: slotSummary(i) }))
  return (
    <div className="ag-screen f2 f2-slots">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">{owner.toUpperCase()} · GM</span><h1 className="ag-h1">FRANCHISE</h1></div>
        <button className="ag-round-btn" onClick={onHome} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        {rows.map(({ i, s }) => (
          <button key={i} className={`f2-slot ag-pop${s ? '' : ' is-empty'}`} style={{ '--d': `${i * 60}ms`, ...(s?.team ? teamVars(s.team) : null) }} onClick={() => onOpen(i)}>
            <span className="f2-slot-n">{i + 1}</span>
            {s?.team ? <Logo s={s.team} size={48} /> : <span className="f2-slot-plus">+</span>}
            <span className="f2-slot-txt">
              <b>{s?.team ? TEAM[s.team].nick.toUpperCase() : s?.setup ? 'NEW FRANCHISE' : 'EMPTY'}</b>
              <small>{s?.setup ? 'SETTING UP' : s ? `${s.year} · ${s.rec}${s.rings ? ` · ${s.rings} RING${s.rings > 1 ? 'S' : ''}` : ''}${s.sandbox ? ' · SANDBOX' : ''}` : 'START A FRANCHISE'}</small>
            </span>
            <IconArrow size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
