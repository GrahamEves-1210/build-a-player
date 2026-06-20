import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Supabase requires an email internally — we derive one from the username silently
const toEmail = (username) => `${username.trim().toLowerCase()}@buildaplayer.app`

export default function AuthModal({ onClose, onAuth }) {
  const [tab, setTab]           = useState('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const reset = () => setError(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Auth not configured yet. Add Supabase credentials to .env.local.'); return }
    if (!username.trim()) { setError('Please enter a username.'); return }
    setLoading(true)
    setError(null)

    const email = toEmail(username)

    if (tab === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Username or password is incorrect.'
          : error.message)
        setLoading(false)
        return
      }
      onAuth(data.user)
      onClose()
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() } },
      })
      if (error) {
        setError(error.message.includes('already registered')
          ? 'That username is already taken.'
          : error.message)
        setLoading(false)
        return
      }
      onAuth(data.user)
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="auth-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13"/>
          </svg>
        </button>

        <div className="auth-logo">Build<em>-A-</em>Player</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => { setTab('signin'); reset() }}>Sign In</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); reset() }}>Create Account</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Username</label>
            <input
              className="auth-input"
              type="text"
              placeholder="YourUsername"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
