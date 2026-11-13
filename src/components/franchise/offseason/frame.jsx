import { createContext, useContext, useMemo } from 'react'
import { FrShell, Bug, Panel } from '../frUi'
import { sfx, haptic } from '../../../lib/juice'
import { safe } from './offUi'

// FRANCHISE · OFFSEASON: the frame every stage stands in, and what the stages are handed (Offseason.jsx fills it).
//   useOff() → { FR, F, o (FR.offseason(F)), at (the rail's stage), eng (the engine's stage), year,
//                act(fn, { say }) (an engine action; a refusal is the red line under the scorebug),
//                say(text, bad), move(fn, title?, none?) (a step that moves the offseason on; with a title the
//                stage was handed to the staff and what they did is kept for the next screen), onExit }

export const RAIL = [
  { id: 'review', name: 'SEASON REVIEW' }, { id: 'direction', name: 'DIRECTION' }, { id: 'staff', name: 'STAFF' }, { id: 'resign', name: 'RE-SIGN' }, { id: 'fa', name: 'FREE AGENCY' },
  { id: 'draft', name: 'THE DRAFT' }, { id: 'udfa', name: 'UNDRAFTED' }, { id: 'camp', name: 'TRAINING CAMP' }, { id: 'season', name: 'NEW SEASON' },
]

export const Ctx = createContext(null)
export const useOff = () => useContext(Ctx)

// The frame every stage stands in: the scorebug (the club, the stage, the cap room), the rail, the page, and the
// buttons. main: { label, onClick, disabled } · side: the same, outlined (DELEGATE) · wide: the page's own columns
export function Frame({ main = null, side = null, children }) {
  const { FR, F, at, year, onExit, report, dropReport, toast, dropToast } = useOff()
  const i = RAIL.findIndex(s => s.id === at)
  const room = useMemo(() => safe(() => FR.capSheet(F).space), [FR, F])
  const cells = at === 'season'
    ? [{ label: `${F.year} SEASON`, value: 'WEEK 1' }]
    : [{ label: String(year), value: 'OFFSEASON' }, ...(room != null ? [{ label: 'CAP ROOM', value: FR.moneyText(room) }] : [])]
  return (
    <>
      <FrShell mainKey={at} bug={<Bug team={F.team} cells={cells} onExit={onExit} exit="HUB" />}
        cta={main ? <>
          {side && <button className="fr-btn fr-btn--line" disabled={side.disabled} onClick={() => { sfx('tap'); haptic('light'); side.onClick() }}>{side.label}</button>}
          <button className="fr-btn" disabled={main.disabled} onClick={() => { sfx('send'); haptic('medium'); main.onClick() }}>{main.label}</button>
        </> : null}>
        <div className="fro">
          <nav className="fro-rail" aria-label="Offseason stages">
            <div className="fro-rail-now"><small>STAGE {i + 1} OF {RAIL.length}</small><b>{RAIL[i].name}</b>{RAIL[i + 1] && <em>NEXT · {RAIL[i + 1].name}</em>}</div>
            <ol>
              {RAIL.map((s, k) => (
                <li key={s.id} className={k < i ? 'is-done' : k === i ? 'is-now' : undefined} aria-current={k === i ? 'step' : undefined}>
                  <i>{k + 1}</i><span>{s.name}</span><em>{k < i ? 'DONE' : k === i ? 'NOW' : ''}</em>
                </li>
              ))}
            </ol>
          </nav>
          <div className="fr-page fro-page">
            {report && (
              <Panel title={report.title} className="fro-report" action={<button className="fr-btn fr-btn--line fr-btn--sm" onClick={() => { sfx('tap'); dropReport() }}>CLOSE</button>}>
                {report.lines.length ? report.lines.map((l, k) => <p key={k} className="fro-line">{l}</p>) : <p className="fro-line is-dim">{report.none}</p>}
              </Panel>
            )}
            {children}
          </div>
        </div>
      </FrShell>
      {toast && <div className={`fr-toast${toast.bad ? '' : ' fro-toast-ok'}`} role="status" onClick={dropToast}>{toast.text}</div>}
    </>
  )
}
