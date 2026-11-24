import { Component } from 'react'
import { reportError } from '../lib/errorLog'
import { isChunkError, healAndReload, healing } from '../lib/chunkHeal'
import './app/infra.css'

// The last line of defence for a render error anywhere under it: a friendly
// "Something broke" screen in the app's look (styles in components/app/infra.css)
// and a report to client_errors (lib/errorLog.js).
// A part of the game that didn't download (a deploy replaced the open tab's files): no crash screen and no report,
// the page fetches the files again and reloads into the new version (lib/chunkHeal.js). Only when that already
// happened in the last minute and it failed again does the screen show, and the report go in.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    if (isChunkError(error)) healAndReload(error)   // (once a page: later calls wait for the same reload)
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    if (isChunkError(error) && healing()) return
    console.error('[ErrorBoundary] caught render error:', error, info)
    reportError(error, 'react', { componentStack: info?.componentStack ?? '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    // the reload is on its way: the plain backdrop, never "Something broke"
    if (healing()) return <div className="inf-crash" aria-busy="true" />
    return (
      <div className="inf-crash" role="alert">
        <div className="inf-crash-card">
          <div className="inf-crash-kicker">FUMBLE</div>
          <div className="inf-crash-title">Something broke</div>
          <p className="inf-crash-sub">Your progress is saved on this device. A reload usually fixes it.</p>
          <button className="inf-btn" onClick={() => healAndReload(this.state.error, { force: true })}>RELOAD</button>
          <button className="inf-link" onClick={() => { window.location.href = '/' }}>Back to home</button>
        </div>
      </div>
    )
  }
}
