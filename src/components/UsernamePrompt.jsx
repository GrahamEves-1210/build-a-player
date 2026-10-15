import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hasDiscord } from '../lib/discord'

// "Pick your username": once, right after a sign-in that came back without a
// saved one (Sign in with Apple: Apple only shares a name the first time, and
// many players hide it; a shared name isn't checked against other players).
// Without one their scores would save as "Player" and they'd show up as Guest.
// Saving goes through functions/api/set-username.js, which checks the name is
// valid, clean and free; "Pick one for me" makes one up. Password accounts save
// their username when they sign up, and discord-join.js names Discord accounts,
// so both are left alone.
const needsName = u => !!u && !u.user_metadata?.username && !hasDiscord(u) && !u.email?.endsWith('@buildaplayer.app')

const VALID = /^[a-zA-Z0-9_-]{3,20}$/
const suggest = user => {
  const m = user?.user_metadata ?? {}
  return String(m.full_name || m.name || '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
}

export default function UsernamePrompt() {
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const look = session => {
      const u = session?.user ?? null
      setUser(needsName(u) ? u : null)
    }
    supabase.auth.getSession().then(({ data }) => look(data?.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => look(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) setName(n => n || suggest(user)) }, [user])

  if (!user) return null

  const save = async pickForMe => {
    const typed = name.trim()
    if (!pickForMe && !VALID.test(typed)) { setError('Use 3 to 20 letters, numbers, _ or -.'); return }
    setBusy(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/set-username`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(pickForMe ? {} : { username: typed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error || 'Could not save that. Try again.'); setBusy(false); return }
      await supabase.auth.refreshSession()   // the game picks up the new name from here
    } catch {
      setError('Could not reach the server. Try again.')
    }
    setBusy(false)
  }

  return (
    <div className="auth-overlay un-overlay">
      <div className="auth-modal" role="dialog" aria-labelledby="un-title">
        <div className="auth-logo" id="un-title">Pick your username</div>
        <p className="un-sub">It's how you show up on leaderboards and in online games. You can't change it later, so pick one you like.</p>
        <form className="auth-form" onSubmit={e => { e.preventDefault(); save(false) }}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="un-input">Username</label>
            <input
              id="un-input"
              className="auth-input"
              type="text"
              placeholder="YourUsername"
              value={name}
              onChange={e => { setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)); setError(null) }}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              style={{ touchAction: 'manipulation' }}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save username'}</button>
        </form>
        <button type="button" className="un-pick" onClick={() => save(true)} disabled={busy}>Pick one for me</button>
      </div>
    </div>
  )
}
