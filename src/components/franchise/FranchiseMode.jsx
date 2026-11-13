import { lazy, Suspense, useEffect } from 'react'
import { Bug, FrShell } from './frUi'
import { dressFor } from './frTeams'
import './franchise.css'

// ── FRANCHISE: a football mode (in SQUAD BUILDER's place on football's Home while lib/franchiseLive.js is on) ──
// Take over an NFL team as its general manager, build the players you want on the game's own build screen (the
// team's real roster fills every other spot), and run it season after season. Everything here, the engine
// (lib/franchise) and the art included, loads only when the mode opens (App.jsx: lazy).
// The look is the mode's own (franchise.css): html.is-fr is on while it's open.

// the kit on one page (dev server only: /?franchise=1&frkit=KC)
const KIT = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('frkit') : null
const FrKit = KIT != null ? lazy(() => import('./FrKit')) : null

export default function FranchiseMode({ user, onHome }) {
  useEffect(() => {
    document.documentElement.classList.add('is-fr')
    return () => { document.documentElement.classList.remove('is-fr'); dressFor(null) }
  }, [])
  if (FrKit) return <Suspense fallback={<div className="fr" />}><FrKit team={KIT || 'KC'} onHome={onHome} /></Suspense>
  return (
    <FrShell bug={<Bug title="FRANCHISE" eyebrow="FOOTBALL" onExit={onHome} exit="HOME" />}>
      <div className="fr-page"><p className="fr-empty">THE FRONT OFFICE IS BEING SET UP</p></div>
    </FrShell>
  )
}
