// DEV ONLY (never in the production build: dev.html is not one of its pages). Game Day on its own, to look at every
// state before the hub mounts it:  http://[::1]:5173/src/components/franchise/gameday/dev.html
//   ?fx=1        the stand-in game (devFixture.js) instead of the engine
//   ?team=KC&opp=BUF&away=1&sb=1&moments=0&seed=abc
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import '../../../app-game.css'
import GameDay from './GameDay'

const q = new URLSearchParams(location.search)
async function boot() {
  let driver, franchise
  if (q.get('fx') === '1') {
    driver = await import('./devFixture')
    franchise = driver.devFranchise({ user: q.get('team') ?? 'KC', opp: q.get('opp') ?? 'BUF', home: q.get('away') !== '1', superBowl: q.get('sb') === '1', moments: q.get('moments') !== '0', seed: q.get('seed') ?? 'dev1', win: q.get('win') === '1' })
  } else {
    driver = await import('./bridge')
    const FR = await import('../../../lib/franchise')
    window.FR = FR
    franchise = FR.createFranchise({ team: q.get('team') ?? 'KC', builds: [], gmName: 'Guest', seed: q.get('seed') ?? 'dev1' })
  }
  function Page() {
    const [fr, setFr] = useState(franchise)
    const [n, setN] = useState(0)
    window.__fr = fr
    return <GameDay key={n} franchise={fr} driver={driver} onFranchise={setFr} onDone={() => setN(x => x + 1)} />
  }
  createRoot(document.getElementById('root')).render(<StrictMode><Page /></StrictMode>)
}
boot()
