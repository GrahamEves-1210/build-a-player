import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

// Feedback goes straight into the `feedback` table (supabase/feedback.sql) —
// read it in the Supabase dashboard. Players can send but never read rows.
const KINDS = [
  { id: 'bug',     label: 'Bug' },
  { id: 'idea',    label: 'Idea' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'other',   label: 'Other' },
]
const MAX = 1500
const COOLDOWN_MS = 60_000

export default function FeedbackModal({ user, isBucket, position, onClose }) {
  const [kind, setKind]       = useState('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const text = message.trim()
    if (text.length < 5) { setError('Add a bit more detail so we can act on it.'); return }
    let last = 0
    try { last = +localStorage.getItem('bap_feedback_at') || 0 } catch {}
    if (Date.now() - last < COOLDOWN_MS) { setError('You just sent feedback. Wait a minute before sending more.'); return }
    if (!supabase) { setError('Feedback is unavailable right now. Try again later.'); return }

    setSending(true); setError(null)
    const { error: insertError } = await supabase.from('feedback').insert({
      kind,
      message: text,
      user_id: user?.id ?? null,
      username: user?.user_metadata?.username ?? null,
      contact: (user ? user.email : email.trim()) || null,
      app: isBucket ? 'bucket' : 'nfl',
      position: position ?? null,
      page: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 300),
    })
    setSending(false)
    if (insertError) {
      console.error('[feedback] send failed:', insertError)
      setError('Could not send your feedback. Check your connection and try again.')
      return
    }
    try { localStorage.setItem('bap_feedback_at', String(Date.now())) } catch {}
    setSent(true)
  }

  // Portalled to <body> so the navbar's own stacking/blur can't clip the overlay
  return createPortal(
    <div className="auth-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13"/>
          </svg>
        </button>

        <div className="auth-logo">Send <em>Feedback</em></div>

        {sent ? (
          <div className="fb-sent">
            <div className="fb-sent-title">Feedback sent</div>
            <p className="fb-sent-body">Thanks — every message gets read.</p>
            <button className="auth-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-tabs fb-kinds">
              {KINDS.map(k => (
                <button key={k.id} type="button" className={`auth-tab ${kind === k.id ? 'active' : ''}`} onClick={() => setKind(k.id)}>{k.label}</button>
              ))}
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="fb-message">
                {kind === 'bug' ? 'What went wrong?' : kind === 'ratings' ? 'Which player, and what should change?' : 'Your feedback'}
              </label>
              <textarea
                id="fb-message"
                className="auth-input fb-textarea"
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, MAX))}
                placeholder={kind === 'bug' ? 'What you did, what happened, and on which device' : ''}
                rows={5}
                required
              />
              <div className="fb-count">{message.length}/{MAX}</div>
            </div>

            {!user && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="fb-email">Email (optional, if you want a reply)</label>
                <input id="fb-email" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send Feedback'}</button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
