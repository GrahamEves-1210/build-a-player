import { IconFlask, IconSliders, IconArrow } from './icons'

// App: Sandbox on the build side — one game-style card in place of the
// website's pill + "?" tooltip. Tap the card to switch it; when it's on, the
// ratings editor is one tap away.
// compact: the small version that sits in the silhouette's corner on desktop
export default function AppSandbox({ on, onToggle, onCustomize, compact = false }) {
  return (
    <div className={`ag-sandbox${on ? ' is-on' : ''}${compact ? ' ag-sandbox--compact' : ''}`}>
      <button className="ag-sandbox-main" role="switch" aria-checked={on} onClick={e => { const card = e.currentTarget.parentElement; onToggle?.(!on); if (!on) setTimeout(() => card.querySelector('.ag-sandbox-edit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60) }}>
        <span className="ag-sandbox-icon"><IconFlask size={22} /></span>
        <span className="ag-sandbox-txt">
          <span className="ag-sandbox-title">SANDBOX{on && <i>ON</i>}</span>
          <span className="ag-sandbox-sub">{on ? 'Your ratings, your rules. This season won\'t save.' : 'Edit any player\'s ratings. Sandbox seasons don\'t save.'}</span>
        </span>
        <span className={`ag-switch${on ? ' is-on' : ''}`} aria-hidden="true"><span /></span>
      </button>
      {on && (
        <button className="ag-sandbox-edit" onClick={onCustomize} aria-label="Edit ratings and build">
          <IconSliders size={17} /> EDIT RATINGS &amp; BUILD <IconArrow size={14} />
        </button>
      )}
    </div>
  )
}
