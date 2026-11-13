import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { engine, loadEngine } from '../frStore'
import { dressFor } from '../frTeams'
import { safe } from './offUi'
import { Ctx } from './frame'
import Review from './Review'
import Direction from './Direction'
import Staff from './Staff'
import Resign from './Resign'
import FreeAgency from './FreeAgency'
import Draft from './Draft'
import Udfa from './Udfa'
import Camp from './Camp'
import NewSeason from './NewSeason'
import './offseason.css'

// ── FRANCHISE · THE OFFSEASON (DESIGN.md section 3, 8, 9; the engine: lib/franchise API.md section 6) ──────
// Mounted by FranchiseMode.jsx with { franchise, onFranchise(next), onDone() }. `franchise` is the engine's one
// object: every action returns the next one, which goes straight back up through onFranchise (the mode saves it).
//
// Nine stages on the rail, in order. The engine has eight of its own; the screen's nine sit on them like this:
//   1 SEASON REVIEW   engine 'review'                 the awards, the honours, retirements, the owner's verdict
//   2 DIRECTION       engine 'review' still           the roster's read, the GM declares, the owner answers
//   3 STAFF           engine 'staff'                  coaches hired and fired, BUILD A COACH, the scout, the tree
//   4 RE-SIGN         engine 'resign'                 the negotiation, the tag, the fifth-year option
//   5 FREE AGENCY     engine 'fa'                     three rounds of offers
//   6 THE DRAFT       engine 'draft'                  the combine, then the war room
//   7 UNDRAFTED       engine 'udfa'
//   8 TRAINING CAMP   engine 'camp', then 'cuts'      drills, holdouts, the cut to the limit
//   9 NEW SEASON      the season has begun (phase 'regular'): the schedule, the rankings, the goals; then onDone
// Every stage is PLAYED or DELEGATED: its screen's main button always moves on (whatever is open goes to the
// staff, as the engine's advanceStage does), and DELEGATE hands the whole stage over at once; what the staff did
// (the club's transactions the hand-over produced) is the first thing on the next screen.
// Nothing here makes anything up: every figure and sentence is the engine's, or is put together from its fields.

const AT = { review: 'review', staff: 'staff', resign: 'resign', fa: 'fa', draft: 'draft', udfa: 'udfa', camp: 'camp', cuts: 'camp' }

export default function Offseason({ franchise: F, onFranchise, onDone }) {
  const [FR, setFR] = useState(engine)
  useEffect(() => { if (!FR) { let live = true; loadEngine().then(m => { if (live) setFR(m) }); return () => { live = false } } }, [FR])
  const [sub, setSub] = useState('review')   // inside the engine's 'review': the review itself, then the direction
  const [report, setReport] = useState(null)
  const [toast, setToast] = useState(null)
  const live = useRef(F); live.current = F
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3800); return () => clearTimeout(id) }, [toast])
  useEffect(() => { dressFor(F.team) }, [F.team])

  // every engine action goes through here. A refusal is the red line under the scorebug; say: show a plain answer too
  const run = useCallback((fn, { say = false } = {}) => {
    const next = fn(live.current)
    if (!next) return null
    live.current = next
    onFranchise(next)
    const fl = next.flash
    if (fl && fl.ok === false && fl.msg) setToast({ text: fl.msg, bad: true })
    else if (say && fl?.msg) setToast({ text: fl.msg, bad: false })
    return next
  }, [onFranchise])
  // (the staff's report from the stage before is put away once the GM does something here)
  const act = useCallback((fn, opts) => { const next = run(fn, opts); if (next && next.flash?.ok !== false) setReport(null); return next }, [run])
  const say = useCallback((text, bad = false) => { if (text) setToast({ text: String(text), bad }) }, [])
  // a step that moves the offseason on: with `title`, the stage was handed to the staff, and what the club's
  // transactions show they did is kept for the next screen
  const move = useCallback((fn, title = null, none = 'The staff left everything as it was.', linesOf = null) => {
    const e = FR, team = live.current.team
    const seen = title && !linesOf ? new Set(safe(() => e.transactions(live.current, 400, team), []).map(t => t.id)) : null
    const next = run(fn)
    if (title && next && next.flash?.ok !== false) {
      const lines = linesOf ? safe(() => linesOf(next), []) : safe(() => e.transactions(next, 400, next.team), []).filter(t => !seen.has(t.id)).reverse().map(t => t.text)
      setReport({ title, lines, none })
    } else setReport(null)
    return next
  }, [FR, run])

  const o = useMemo(() => (FR && F.phase === 'offseason' ? safe(() => FR.offseason(F)) : null), [FR, F])
  if (!FR) return <div className="fr" />
  const eng = o?.stage?.id ?? null
  const at = !o ? 'season' : eng === 'review' ? (sub === 'direction' ? 'direction' : 'review') : AT[eng] ?? 'review'
  const ctx = { FR, F, o, at, eng, year: o?.year ?? F.year, act, say, move, onExit: onDone, report, dropReport: () => setReport(null), toast, dropToast: () => setToast(null), toDirection: () => { setReport(null); setSub('direction') }, toReview: () => setSub('review') }
  const Stage = { review: Review, direction: Direction, staff: Staff, resign: Resign, fa: FreeAgency, draft: Draft, udfa: Udfa, camp: Camp, season: NewSeason }[at]
  return <Ctx.Provider value={ctx}><Stage key={at} onDone={onDone} /></Ctx.Provider>
}
export { Offseason }
