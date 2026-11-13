// DEV ONLY (never in the production build: dev.html is not one of its pages). BUILD THE COACH on its own:
//   http://[::1]:5173/src/components/franchise/coach/dev.html?team=KC      (&new=1: forget the build kept for the tab)
// What onDone / onBack were handed is on window.__coach and under the screen.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import '../../../app-game.css'
import '../franchise.css'
import '../franchise-screens.css'
import { dressFor } from '../frTeams'
import CoachBuild from './CoachBuild'

const q = new URLSearchParams(location.search)
const team = q.get('team') ?? 'KC'
if (q.get('new') === '1') sessionStorage.removeItem('bap_fr_coach_build')
window.__errs = []
window.addEventListener('error', e => window.__errs.push(String(e.error?.stack ?? e.message).slice(0, 400)))
dressFor(team)
function Page() {
  const [out, setOut] = useState(undefined)
  window.__coach = out
  if (out !== undefined) return <pre style={{ margin: 0, padding: 16, color: '#f2f4f5', font: '13px/1.5 monospace', whiteSpace: 'pre-wrap' }}>{JSON.stringify(out, null, 2)}</pre>
  return <CoachBuild team={team} onDone={setOut} onBack={() => setOut('BACK')} />
}
createRoot(document.getElementById('root')).render(<StrictMode><Page /></StrictMode>)
