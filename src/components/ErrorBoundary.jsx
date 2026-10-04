import { Component } from 'react'

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
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#050705', color: '#fff', fontFamily: 'system-ui, sans-serif',
        textAlign: 'center', padding: 24,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong loading the page.</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#74C69D', color: '#050705', fontWeight: 700, fontSize: 14,
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
