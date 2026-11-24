import { Component } from 'react'
import { reportError } from '../lib/errorLog'
import { isChunkError, healAndReload } from '../lib/chunkHeal'
import './app/infra.css'

// The last line of defence for a render error anywhere under it: a friendly
// "Something broke" screen in the app's look (styles in components/app/infra.css)
// and a report to client_errors (lib/errorLog.js).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught render error:', error, info)
    reportError(error, 'react', { componentStack: info?.componentStack ?? '' })
    // a part of the game that didn't download: repair the files and reload on its own (lib/chunkHeal.js)
    if (isChunkError(error)) healAndReload(error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
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
