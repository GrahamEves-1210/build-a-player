import { useSyncExternalStore } from 'react'
import { IS_APP } from '../../lib/platform'
import { getUpdateState, subscribeUpdate, dismissUpdate, openStore } from '../../lib/versionCheck'

// App only. Below app_config.min_version: a full-screen "Update required" that
// can't be closed. Below latest_version: a small card, dismissible, once per
// version. The check itself runs from lib/appInfra.js (lib/versionCheck.js).
export default function UpdateGate() {
  const s = useSyncExternalStore(subscribeUpdate, getUpdateState)
  if (!IS_APP || s.status === 'ok') return null

  if (s.status === 'hard') return (
    <div className="inf-update-wall" role="alertdialog" aria-modal="true" aria-labelledby="inf-update-title">
      <div className="inf-crash-card">
        <div className="inf-crash-kicker">NEW VERSION</div>
        <div className="inf-crash-title" id="inf-update-title">Update required</div>
        <p className="inf-crash-sub">This version of Build-A-Player is too old to keep playing. Grab the update to get back in the game. Your progress comes with you.</p>
        <button className="inf-btn" onClick={openStore}>UPDATE</button>
        {s.current && <div className="inf-update-ver">You have {s.current}{s.latest ? ` · Latest ${s.latest}` : ''}</div>}
      </div>
    </div>
  )

  return (
    <div className="inf-update-card" role="status">
      <div className="inf-update-text">
        <b>Update available</b>
        <span>{s.latest ? `Version ${s.latest} is out.` : 'A new version is out.'} New stuff and fixes.</span>
      </div>
      <button className="inf-btn inf-btn--sm" onClick={openStore}>UPDATE</button>
      <button className="inf-x" aria-label="Dismiss" onClick={dismissUpdate}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  )
}
