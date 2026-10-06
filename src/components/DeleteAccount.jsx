import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Permanent account deletion (the App Store requires it in-app). The link opens
// an inline confirmation; functions/api/delete-account.js verifies the session,
// cancels any Plus subscription and removes the user's data.
export default function DeleteAccount({ onDeleted }) {
  const [open, setOpen]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    setBusy(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not delete your account. Try again.')
      await supabase.auth.signOut().catch(() => {})
      try { localStorage.removeItem('bap_subscribed'); localStorage.removeItem('bap_ads_off') } catch {}
      onDeleted?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (!open) return <button className="prf-delete-link" onClick={() => setOpen(true)}>Delete account</button>

  return (
    <div className="prf-delete-confirm">
      <div className="prf-delete-title">Delete your account?</div>
      <p className="prf-delete-body">
        This permanently removes your account, every saved season, your leaderboard history and your friends.
        A Plus subscription is cancelled. This can’t be undone.
      </p>
      {error && <div className="auth-error">{error}</div>}
      <div className="prf-changepw-btns">
        <button className="prf-delete-btn" disabled={busy} onClick={handleDelete}>{busy ? 'Deleting…' : 'Delete Account'}</button>
        <button className="prf-changepw-cancel" disabled={busy} onClick={() => { setOpen(false); setError(null) }}>Cancel</button>
      </div>
    </div>
  )
}
