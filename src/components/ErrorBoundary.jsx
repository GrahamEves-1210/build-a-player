import { Component } from 'react'
import { reportError } from '../lib/errorLog'
import './app/infra.css'

// The last line of defence for a render error anywhere under it: a friendly
// "Something broke" screen in the app's look (styles in components/app/infra.css)
// and a report to client_errors (lib/errorLog.js).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught render error:', error, info)
    reportError(error, 'react', { componentStack: info?.componentStack ?? '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="inf-crash" role="alert">
        <div className="inf-crash-card">
          <div className="inf-crash-kicker">FUMBLE</div>
          <div className="inf-crash-title">Something broke</div>
          <p className="inf-crash-sub">Your progress is saved on this device. A reload usually fixes it.</p>
          <button className="inf-btn" onClick={() => window.location.reload()}>RELOAD</button>
          <button className="inf-link" onClick={() => { window.location.href = '/' }}>Back to home</button>
        </div>
      </div>
    )
  }
}
