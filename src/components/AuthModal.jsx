import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/track'
import { supabase } from '../lib/supabase'
import { signInWithDiscord, signInWithApple } from '../lib/discord'
import { IconDiscord } from './Navbar'
import { LIVE_HTTP } from '../lib/liveUrl'

// Supabase requires an email internally — we derive one from the username silently
const toEmail = (username) => `${username.trim().toLowerCase()}@buildaplayer.app`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// COPPA: a neutral age question before an account is made (month + year, nothing
// hinting at the answer). Under 13 can't make one, and that sticks on this device so
// going back and picking another year doesn't get round it. The birthday isn't saved.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 90 }, (_, i) => THIS_YEAR - i)
const U13_KEY = 'bap_u13'
const isU13Device = () => { try { return localStorage.getItem(U13_KEY) === '1' } catch { return false } }
const under13 = (m, y) => {
  const now = new Date()
  const age = now.getFullYear() - y - (now.getMonth() < m ? 1 : 0)
  return age < 13
}

export default function AuthModal({ onClose, onAuth }) {
  const [tab, setTab]                 = useState('signin')
  const [username, setUsername]       = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(false)
  const [bMonth, setBMonth]           = useState('')
  const [bYear, setBYear]             = useState('')
  const [blocked, setBlocked]         = useState(isU13Device)

  // sign-up only: the birthday has to be filled and 13+ (the Apple / Discord buttons too,
  // since on this tab they make the account)
  const ageOk = () => {
    if (tab !== 'signup') return true
    if (blocked) return false
    if (bMonth === '' || bYear === '') { setError('Please enter your birthday.'); return false }
    if (under13(Number(bMonth), Number(bYear))) {
      try { localStorage.setItem(U13_KEY, '1') } catch {}
      setBlocked(true); setError(null)
      return false
    }
    return true
  }

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

  const reset = () => { setError(null); setSent(false) }
  // forgot password: the live server emails a reset link to the account's contact email
  const [forgot, setForgot] = useState(false)
  const [sent, setSent] = useState(false)
  const sendReset = async e => {
    e.preventDefault()
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) { setError('Enter your username.'); return }
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${LIVE_HTTP}/api/reset-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim() }) })
      if (!r.ok) throw new Error()
      setSent(true)
    } catch { setError("Couldn't send that right now. Try again in a minute.") }
    setLoading(false)
  }

  const handleDiscord = async () => {
    if (!supabase || !ageOk()) return
    setLoading(true); setError(null)
    discordPending.current = true
    const { error } = await signInWithDiscord()   // leaves for Discord on success
    if (error) { discordPending.current = false; setError('Could not reach Discord. Try again.'); setLoading(false) }
  }

  // Sign in with Apple, the same round trip as Discord (the website leaves for Apple;
  // the app opens its in-app browser)
  const handleApple = async () => {
    if (!supabase || !ageOk()) return
    setLoading(true); setError(null)
    discordPending.current = true
    const { error } = await signInWithApple()
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
    if (!ageOk()) return
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
      track('signin', { userId: data.user?.id ?? null })
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
      track('signup', { userId: data.user?.id ?? null })
      // (the contact email is saved with the account's own sign-in data above: private to the
      // player and the server, never on the public accounts row; lib/contactEmail.js)
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
          <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => { setTab('signin'); setForgot(false); reset() }}>Sign In</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setForgot(false); reset() }}>Create Account</button>
        </div>

        {tab === 'signup' && blocked ? (
          <p className="auth-forgot-note">Sorry, you need to be 13 or older to make an account. You can still play as a guest.</p>
        ) : (<>
        {tab === 'signup' && (
          <div className="auth-field auth-bday">
            <label className="auth-label">Birthday</label>
            <div className="auth-bday-row">
              <select className="auth-input" aria-label="Birth month" value={bMonth} onChange={e => setBMonth(e.target.value)}>
                <option value="" disabled>Month</option>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select className="auth-input" aria-label="Birth year" value={bYear} onChange={e => setBYear(e.target.value)}>
                <option value="" disabled>Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}

        <button type="button" className="auth-apple" onClick={handleApple} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.28-.88-2.3-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z"/></svg>
          <span>Continue with Apple</span>
        </button>
        {/* In the app, Discord opens in an in-app browser and returns to the app (lib/appAuth.js) */}
        <button type="button" className="auth-discord" onClick={handleDiscord} disabled={loading}>
          <IconDiscord />
          <span>Continue with Discord</span>
        </button>
        <div className="auth-discord-note">Also joins you to the Build-A-Player Discord</div>
        <div className="auth-or"><span>or</span></div>

        {forgot ? (
          <form className="auth-form" onSubmit={sendReset}>
            <div className="auth-forgot-title">Reset your password</div>
            {sent ? (
              <p className="auth-forgot-note">If <b>{username.trim()}</b> has an email on file, a reset link is on its way. Check your inbox (and spam) for an email from Build-A-Player.</p>
            ) : (
              <>
                <p className="auth-forgot-note">Enter your username. We'll email a reset link to the address you signed up with.</p>
                <div className="auth-field">
                  <label className="auth-label">Username</label>
                  <input className="auth-input" type="text" placeholder="YourUsername" value={username} onChange={e => setUsername(e.target.value)}
                    required autoComplete="username" autoCapitalize="none" inputMode="text" style={{ touchAction: 'manipulation' }} />
                </div>
                {error && <div className="auth-error">{error}</div>}
                <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : 'Email me a reset link'}</button>
              </>
            )}
            <button type="button" className="auth-forgot" onClick={() => { setForgot(false); reset() }}>Back to sign in</button>
          </form>
        ) : (
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
          {tab === 'signin' && (
            <button type="button" className="auth-forgot" onClick={() => { setForgot(true); reset() }}>Forgot password?</button>
          )}
        </form>
        )}
        </>)}
      </div>
    </div>
  )
}
