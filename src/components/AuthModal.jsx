import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithDiscord } from '../lib/discord'
import { IconDiscord } from './Navbar'
import { IS_APP } from '../lib/platform'

// Supabase requires an email internally — we derive one from the username silently
const toEmail = (username) => `${username.trim().toLowerCase()}@buildaplayer.app`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthModal({ onClose, onAuth }) {
  const [tab, setTab]                 = useState('signin')
  const [username, setUsername]       = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(false)

  const reset = () => setError(null)

  const handleDiscord = async () => {
    if (!supabase) return
    setLoading(true); setError(null)
    const { error } = await signInWithDiscord()   // leaves for Discord on success
    if (error) { setError('Could not reach Discord. Try again.'); setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!supabase) { setError('Auth not configured yet. Add Supabase credentials to .env.local.'); return }
    if (!username.trim()) { setError('Please enter a username.'); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, underscores, and hyphens.')
      return
    }
    if (tab === 'signup' && !EMAIL_RE.test(contactEmail.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    setError(null)

    const email = toEmail(username)

    if (tab === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(
          error.message === 'Invalid login credentials' ? 'Username or password is incorrect.' :
          error.message.toLowerCase().includes('not confirmed') ? 'Account sign-up is not complete. Please try creating your account again.' :
          error.message.toLowerCase().includes('validate email') ? 'Username can only contain letters, numbers, underscores, and hyphens.' :
          error.message
        )
        setLoading(false)
        return
      }
      onAuth(data.user)
      onClose()
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim(), contact_email: contactEmail.trim() } },
      })
      if (error) {
        setError(error.message.includes('already registered')
          ? 'That username is already taken.'
          : error.message)
        setLoading(false)
        return
      }
      if (data.user) {
        const { error: updateError } = await supabase.from('accounts')
          .update({ email: contactEmail.trim() }).eq('id', data.user.id)
        if (updateError) console.error('[auth] failed to save contact email:', updateError)
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

        {/* Discord sign-in returns to a web URL — hidden in the iOS/Android app until it has its own redirect */}
        {!IS_APP && (
          <>
            <button type="button" className="auth-discord" onClick={handleDiscord} disabled={loading}>
              <IconDiscord />
              <span>Continue with Discord</span>
            </button>
            <div className="auth-discord-note">Also joins you to the Build-A-Player Discord</div>
            <div className="auth-or"><span>or</span></div>
          </>
        )}

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
              inputMode="text"
              style={{ touchAction: 'manipulation' }}
            />
          </div>

          {tab === 'signup' && (
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ touchAction: 'manipulation' }}
              />
            </div>
          )}

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
              style={{ touchAction: 'manipulation' }}
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
