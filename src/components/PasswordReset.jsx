import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// The "set a new password" step. The reset email's link (live/src/reset.js) opens the site
// with a recovery session; Supabase reports it as PASSWORD_RECOVERY, and this asks for the
// new password. Mounted once, at the root (main.jsx), like the username prompt.
export default function PasswordReset() {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!supabase) return
    // (the link's address says so too, in case the event fired before this mounted)
    if (/type=recovery/.test(window.location.hash)) setOpen(true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(e => { if (e === 'PASSWORD_RECOVERY') setOpen(true) })
    return () => subscription.unsubscribe()
  }, [])

  if (!open) return null
  const close = () => { setOpen(false); if (window.location.search.includes('reset=1') || window.location.hash) window.history.replaceState({}, '', window.location.pathname) }
  const save = async e => {
    e.preventDefault()
    if (pw.length < 6) { setError('Use at least 6 characters.'); return }
    if (pw !== pw2) { setError('Those don\'t match.'); return }
    setBusy(true); setError(null)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (err) { setError(/expired|invalid|session/i.test(err.message) ? 'This link has expired. Ask for a new one from Sign In → Forgot password.' : err.message); return }
    setDone(true)
  }
  return (
    <div className="auth-overlay" role="dialog" aria-label="Set a new password">
      <div className="auth-modal">
        <div className="auth-logo">Build<em>-A-</em>Player</div>
        {done ? (
          <div className="auth-form">
            <div className="auth-forgot-title">Password changed</div>
            <p className="auth-forgot-note">You're signed in. Use the new password next time you sign in with your username.</p>
            <button className="auth-submit" type="button" onClick={close}>Let's play</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={save}>
            <div className="auth-forgot-title">Set a new password</div>
            <div className="auth-field">
              <label className="auth-label">New password</label>
              <input className="auth-input" type="password" placeholder="Min. 6 characters" value={pw} onChange={e => setPw(e.target.value)} minLength={6} required autoComplete="new-password" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Again</label>
              <input className="auth-input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} minLength={6} required autoComplete="new-password" />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Save password'}</button>
            <button type="button" className="auth-forgot" onClick={close}>Not now</button>
          </form>
        )}
      </div>
    </div>
  )
}
