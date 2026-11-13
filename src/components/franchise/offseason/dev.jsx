// DEV ONLY (never in the production build: dev.html is not one of its pages). The offseason on its own, on a
// league made here and kept in memory (nothing is saved, no slot is touched):
//   http://[::1]:5173/src/components/franchise/offseason/dev.html?team=KC&seed=dev&to=fa
//   to: review (default) | staff | resign | fa | draft | udfa | camp | cuts | season: the stages before it are
//       left to the staff. &gm=Graham · &auto=1: those stages are run the way DELEGATE runs them
// window.__off = { FR, F (the franchise now), run(fn) (an engine action from the console), done }
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import '../../../app-game.css'
import '../franchise.css'
import '../franchise-screens.css'
import { dressFor } from '../frTeams'
import { loadEngine } from '../frStore'
import Offseason from './Offseason'

const q = new URLSearchParams(location.search)
const team = q.get('team') ?? 'KC', to = q.get('to') ?? 'review', auto = q.get('auto') === '1'
window.__errs = []
window.addEventListener('error', e => window.__errs.push(String(e.error?.stack ?? e.message).slice(0, 400)))
dressFor(team)
function Page() {
  const [FR, setFR] = useState(null)
  const [F, setF] = useState(null)
  const [done, setDone] = useState(false)
  useEffect(() => {
    loadEngine().then(m => {
      let f = m.createFranchise({ team, gmName: q.get('gm') ?? 'Graham', seed: q.get('seed') ?? 'dev' })
      f = m.simTo(f, 'offseason')
      for (let k = 0; k < 12 && f.phase === 'offseason' && to !== 'review' && m.offseason(f).stage.id !== to; k++) f = m.advanceStage(f, auto ? { auto: true } : undefined)
      setFR(m); setF(f)
    })
  }, [])
  window.__off = { FR, F, done, run: fn => { const n = fn(F); setF(n); return n?.flash ?? null } }
  if (!F) return <div className="fr"><p className="fr-empty">BUILDING A LEAGUE AND PLAYING A SEASON</p></div>
  if (done) return <div className="fr"><p className="fr-empty" id="dev-done">onDone: {F.phase} · WEEK {F.week} · {F.year}</p></div>
  return <Offseason franchise={F} onFranchise={setF} onDone={() => setDone(true)} />
}
createRoot(document.getElementById('root')).render(<StrictMode><Page /></StrictMode>)
