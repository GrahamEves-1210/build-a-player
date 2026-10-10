import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { signInWithDiscord } from '../lib/discord'
import { IS_APP } from '../lib/platform'
import { IconDiscord } from './Navbar'

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

  // App: Discord finishes outside this sheet (in-app browser → back to the app),
  // so close on the sign-in it brings back, and stop "loading" if the browser is dismissed
  const discordPending = useRef(false)
  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && discordPending.current) { discordPending.current = false; onAuth?.(session.user); onClose?.() }
    })
    const done = () => setLoading(false)
    window.addEventListener('bap:oauth-closed', done)
    return () => { subscription.unsubscribe(); window.removeEventListener('bap:oauth-closed', done) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => setError(null)

  const handleDiscord = async () => {
    if (!supabase) return
    setLoading(true); setError(null)
    discordPending.current = true
    const { error } = await signInWithDiscord()   // leaves for Discord on success
    if (error) { discordPending.current = false; setError('Could not reach Discord. Try again.'); setLoading(false) }
  }

  // App only: Sign in with Apple (lib/appAuth.js), the same round trip as Discord
  const handleApple = async () => {
    if (!supabase) return
    setLoading(true); setError(null)
    discordPending.current = true
    const { appApple } = await import('../lib/appAuth')
    const { error } = await appApple()
    if (error) { discordPending.current = false; setError('Could not reach Apple. Try again.'); setLoading(false) }
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

        {IS_APP && (
          <button type="button" className="auth-apple" onClick={handleApple} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.28-.88-2.3-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z"/></svg>
            <span>Continue with Apple</span>
          </button>
        )}
        {/* In the app, Discord opens in an in-app browser and returns to the app (lib/appAuth.js) */}
        <button type="button" className="auth-discord" onClick={handleDiscord} disabled={loading}>
          <IconDiscord />
          <span>Continue with Discord</span>
        </button>
        <div className="auth-discord-note">Also joins you to the Build-A-Player Discord</div>
        <div className="auth-or"><span>or</span></div>

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
