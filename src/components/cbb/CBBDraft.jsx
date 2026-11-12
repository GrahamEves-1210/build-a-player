import { useEffect, useState } from 'react'
import { valToGrade } from '../../utils/simulation'
import { IconClose } from '../app/icons'
import { sfx } from '../../lib/juice'
import { CBB_POS, collegeGap, draftProj, projText } from './cbbShared'
import { CLASS_NAME } from './cbbClass'

// ── ENTER THE NBA DRAFT: a finished college season becomes a new basketball Career ──
// Same position, same build, with the jump to the pros taken off his ratings first: every trait,
// physical, skill and mental, drops two steps (A+ → A-, B → C+); his Size doesn't move.
// The screen shows each trait before and after, and why, before anything is made. The career then
// starts at the combine like any other (lib/career.js newCareer, the Career save slots), with where he
// came from kept on it (c.college), his draft projection included: the college season's stock is where
// Career's draft starts him (c.college.proj, lib/career.js stockOf), so a projected top-10 pick goes
// about there and a Day 3 grade goes on Day 3; the combine and the interviews still move him a little.
// Every slot full: he picks the one to replace, as Career does.
// (the gap is cfbShared.js collegeGap, the same one Start in College adds)
export function dropRatings(build, types, physical, pos = null) {
  return Object.fromEntries(types.map(t => {
    const chip = build[t]
    if (!chip) return [t, chip]
    const by = collegeGap(pos, t)
    return [t, { ...chip, val: Math.max(0, (chip.val ?? 0) - by), collegeVal: chip.val }]
  }))
}

// cls: the class he leaves as (a junior or a senior); age: how old he is on draft day (a senior is a year older);
// history: the college seasons before this one (the career's line counts them)
export default function CBBDraft({ build, types, pos, result, user, userName, playerName = null, sandbox, cls = null, age = null, history = [], onCancel, onDone }) {
  const [M, setM] = useState(null)        // lib/career.js, loaded when this opens
  const [slots, setSlots] = useState(null)
  const [slot, setSlot] = useState(null)
  const [busy, setBusy] = useState(false)
  const uid = user?.id ?? null
  useEffect(() => {
    let live = true
    import('../../lib/career').then(m => {
      if (!live) return
      setM(m)
      m.loadSlots('bucket', uid).then(l => {
        if (!live) return
        setSlots(l)
        const empty = l.findIndex(c => !c)
        setSlot(empty >= 0 ? empty : null)
      })
    })
    return () => { live = false }
  }, [uid])
  const physical = M?.SPORT?.bucket?.physical?.[pos] ?? []
  const after = M ? dropRatings(build, types, physical, pos) : null
  const attr = M?.SPORT?.bucket?.attr?.[pos] ?? null
  const label = t => attr?.[t]?.label ?? build[t]?.label ?? t
  const full = slots && slots.every(Boolean)
  const c = result.cbb ?? {}
  const school = result.team?.school ?? result.team?.name
  const years = history.length + 1
  const line = [years > 1 ? `${years} college seasons` : null, c.record?.final ?? `${result.wins}-${result.losses}`, (c.apPath?.length && c.apPath[c.apPath.length - 1].rank) ? `Final No. ${c.apPath[c.apPath.length - 1].rank}` : null, c.ncaa?.exit && c.ncaa.exit !== 'First Round' && c.ncaa.exit !== 'First Four' ? (result.champion ? 'National champions' : c.ncaa.exit === 'National Championship' ? 'National runner-up' : c.ncaa.exit === 'Second Round' ? null : c.ncaa.exit) : null, c.awards?.wooden?.userWon ? 'Wooden Award' : c.awards?.wooden?.userFinalist ? 'Wooden finalist' : c.awards?.allAmerica?.user ? `${c.awards.allAmerica.user}-team All-American` : null, c.draft?.label ?? null].filter(Boolean).join(' · ')
  const proj = draftProj(c.draft)
  const go = () => {
    if (!M || slot == null || busy) return
    setBusy(true)
    if (slots[slot]) M.clearCareer('bucket', uid, slot)
    const career = {
      ...M.newCareer({ sport: 'bucket', uid, pos, build: after, name: playerName || userName, slot, owner: userName, college: { school: result.team?.short, schoolName: school, line, ...(proj ? { proj } : {}) } }),
      sandbox: !!sandbox,
      ...(age ? { age } : {}),
    }
    M.saveCareer(career)
    sfx('purchase')
    onDone(career)
  }
  return (
    <div className="cfbd-overlay" role="dialog" aria-modal="true" aria-label="Enter the NBA Draft">
      <div className="cfbd">
        <div className="cfbd-head">
          <div><small>{CBB_POS[pos].label} · {school}{cls ? ` · ${CLASS_NAME[cls]}` : ''}</small><h2>Enter the NBA Draft</h2></div>
          <button className="ag-round-btn" onClick={onCancel} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <p className="cfbd-why"><b>The jump to the pros.</b> NBA players are longer, quicker and stronger than anyone he saw in college, so his ratings come down before the combine: <b>every trait drops two grades</b> (an A+ becomes an A-); his size is his size. He earns it back in the league the way every Career player does.{c.draft ? <> <b>His draft stock goes with him:</b> {String(c.draft.label).replace(/^Projected /, '').replace(/^./, x => x.toUpperCase())} ({projText(c.draft)}). The combine and the interviews can still move it a little.</> : null}</p>
        {!M ? <p className="cfbd-wait">Loading Career…</p> : (
          <>
            <table className="cfbd-table">
              <thead><tr><th>TRAIT</th><th>COLLEGE</th><th /><th>NBA</th></tr></thead>
              <tbody>
                {types.filter(t => build[t]).map(t => (
                  <tr key={t}>
                    <td>{label(t)}<small>{t === 'size' ? 'His frame · no change' : 'Down two grades'}</small></td>
                    <td className="is-g">{valToGrade(build[t].val)}</td>
                    <td className="is-arrow" aria-hidden="true">→</td>
                    <td className="is-g is-new">{valToGrade(after[t].val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="cfbd-slots">
              <span className="cfbd-slots-hd">{full ? 'EVERY CAREER SLOT IS FULL · PICK ONE TO REPLACE' : `CAREER SLOT ${(slot ?? 0) + 1}`}</span>
              {full && slots.map((s, i) => (
                <button key={i} className={`cfbd-slot${slot === i ? ' is-on' : ''}`} onClick={() => setSlot(i)} aria-pressed={slot === i}>
                  <b>SLOT {i + 1}</b><span>{s.name} · {M.POS_LABEL?.[s.pos] ?? s.pos.toUpperCase()} · {s.phase === 'retired' ? 'Retired' : s.phase === 'draft' ? 'Draft day' : `Year ${(s.year ?? 0) + 1}`}</span>
                  <i>{slot === i ? 'REPLACE' : ''}</i>
                </button>
              ))}
              {full && slot != null && <p className="cfbd-warn">Slot {slot + 1}'s career is deleted for good.</p>}
            </div>
            {sandbox && <p className="cfbd-note">Built in Sandbox, so this career is a Sandbox career: it's tagged SANDBOX and earns no XP or rewards.</p>}
            <div className="cfbd-actions">
              <button className="cfbs-btn is-main" disabled={slot == null || busy} onClick={go}>{full && slot != null ? `REPLACE SLOT ${slot + 1} · ENTER THE DRAFT` : 'ENTER THE DRAFT'}</button>
              <button className="cfbs-btn" onClick={onCancel}>NOT YET</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
