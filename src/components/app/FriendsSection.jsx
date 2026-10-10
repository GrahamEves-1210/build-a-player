import { useCallback, useEffect, useState } from 'react'
import { NameTag, AvatarBadge } from './NameTag'
import { IconCheck, IconClose, IconArrow, IconProfile, IconSend } from './icons'
import { getUsername } from '../../lib/discord'
import { loadFriends, searchPlayers, sendFriendRequest, respondToRequest } from '../../lib/friends'
import FriendProfile from './FriendProfile'
import './friends.css'

// Profile → Friends: your friends (tap one for their profile), requests waiting
// on you, and adding someone by username. Same friend list as the Blacktop 1v1
// lobby (VersusLobby), so a friend added in either place shows in both.

const signIn = () => window.dispatchEvent(new CustomEvent('bap:auth'))

export default function FriendsSection({ user, isBucket = false }) {
  const uid = user?.id ?? null
  const myName = getUsername(user) || 'Player'
  const [list, setList] = useState({ friends: [], incoming: [], outgoing: [] })
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)   // null = no search yet
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(null)         // id of the row being worked on
  const [open, setOpen] = useState(null)         // the friend whose profile is open

  const refresh = useCallback(async () => {
    if (!uid) return
    try {
      setList(await loadFriends(uid))
      setLoadErr(false)
    } catch { setLoadErr(true) }
    setLoading(false)
  }, [uid])

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    refresh()
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [uid, refresh])

  if (!uid) {
    return (
      <section className="fr-section" aria-labelledby="fr-title">
        <div className="fr-head"><h2 className="fr-title" id="fr-title">FRIENDS</h2></div>
        <div className="fr-guest">
          <span className="fr-guest-ico"><IconProfile size={20} /></span>
          <span className="fr-guest-txt">Sign in to add friends, see their best builds and play them 1v1.</span>
          <button className="ag-btn fr-guest-btn" onClick={signIn}>SIGN IN</button>
        </div>
      </section>
    )
  }

  async function search(e) {
    e?.preventDefault()
    const term = q.trim()
    if (!term) return
    setSearching(true); setMsg(''); setResults(null)
    try {
      const r = await searchPlayers(term, uid)
      setResults(r)
      if (!r.length) setMsg(term.toLowerCase() === myName.toLowerCase() ? "That's you" : 'No player with that name')
    } catch { setMsg("Couldn't search right now") }
    setSearching(false)
  }

  async function add(p) {
    setBusy(p.id); setMsg('')
    try {
      await sendFriendRequest(uid, myName, p)
      setResults(rs => rs?.map(r => (r.id === p.id ? { ...r, state: 'sent' } : r)))
      setMsg(`Request sent to ${p.username}`)
      refresh()
    } catch (err) { setMsg(`Couldn't send: ${err?.message || 'try again'}`) }
    setBusy(null)
  }

  async function respond(reqId, accept, otherId) {
    setBusy(reqId)
    try {
      await respondToRequest(reqId, accept)
      if (otherId) setResults(rs => rs?.map(r => (r.id === otherId ? { ...r, state: accept ? 'friends' : 'none' } : r)))
      await refresh()
    } catch { setMsg("Couldn't update that request") }
    setBusy(null)
  }

  const { friends, incoming, outgoing } = list

  return (
    <section className="fr-section" aria-labelledby="fr-title">
      <div className="fr-head">
        <h2 className="fr-title" id="fr-title">FRIENDS{friends.length > 0 && <span className="fr-count">{friends.length}</span>}</h2>
        {incoming.length > 0 && <span className="fr-badge">{incoming.length} NEW</span>}
      </div>

      {/* Add a friend by username */}
      <form className="fr-search" onSubmit={search} role="search">
        <input
          className="fr-input"
          value={q}
          onChange={e => { setQ(e.target.value); setMsg(''); if (!e.target.value) setResults(null) }}
          placeholder="Add a friend by username"
          aria-label="Search players by username"
          autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search"
          maxLength={40}
        />
        <button className="ag-btn fr-find" type="submit" disabled={searching || !q.trim()}>{searching ? '…' : 'FIND'}</button>
      </form>
      {msg && <p className="fr-note" role="status">{msg}</p>}
      {results?.length > 0 && (
        <div className="fr-list fr-list--results">
          {results.map(p => (
            <div key={p.id} className="fr-row">
              <AvatarBadge uid={p.id} name={p.username} size={34} />
              <span className="fr-row-name"><NameTag uid={p.id} name={p.username} plate={false} /></span>
              {p.state === 'none' && <button className="fr-pill fr-pill--go" onClick={() => add(p)} disabled={busy === p.id} aria-label={`Send ${p.username} a friend request`}><IconSend size={14} /> ADD</button>}
              {p.state === 'sent' && <span className="fr-pill">SENT</span>}
              {p.state === 'friends' && <span className="fr-pill">FRIENDS</span>}
              {p.state === 'incoming' && <button className="fr-pill fr-pill--go" onClick={() => respond(p.reqId, true, p.id)} disabled={busy === p.reqId}>ACCEPT</button>}
            </div>
          ))}
        </div>
      )}

      {/* Requests waiting on me */}
      {incoming.length > 0 && (
        <>
          <div className="fr-sub-head"><span className="ag-eyebrow">REQUESTS</span></div>
          <div className="fr-list">
            {incoming.map(r => (
              <div key={r.id} className="fr-row fr-row--req">
                <AvatarBadge uid={r.from_id} name={r.from_username} size={34} />
                <span className="fr-row-name">
                  <NameTag uid={r.from_id} name={r.from_username || 'Player'} plate={false} />
                  <small>wants to be friends</small>
                </span>
                <button className="fr-icon-btn fr-icon-btn--yes" onClick={() => respond(r.id, true)} disabled={busy === r.id} aria-label={`Accept friend request from ${r.from_username || 'player'}`}><IconCheck size={16} /></button>
                <button className="fr-icon-btn" onClick={() => respond(r.id, false)} disabled={busy === r.id} aria-label={`Decline friend request from ${r.from_username || 'player'}`}><IconClose size={16} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* My friends */}
      <div className="fr-list">
        {loading && <div className="fr-loading" aria-label="Loading friends"><span /><span /><span /></div>}
        {!loading && loadErr && <p className="fr-note">Couldn't load your friends. <button className="fr-link" onClick={refresh}>Retry</button></p>}
        {!loading && !loadErr && friends.length === 0 && (
          <p className="fr-empty">No friends yet. Find someone by their username above, or add them from the 1v1 lobby.</p>
        )}
        {friends.map(f => (
          <button key={f.id} className="fr-row fr-row--friend" onClick={() => setOpen(f)} aria-label={`Open ${f.username}'s profile`}>
            <AvatarBadge uid={f.id} name={f.username} size={40} />
            <span className="fr-row-name"><NameTag uid={f.id} name={f.username} /></span>
            <IconArrow size={14} />
          </button>
        ))}
      </div>

      {outgoing.length > 0 && (
        <p className="fr-pending">Waiting on {outgoing.map(r => r.to_username || 'a player').join(', ')}</p>
      )}

      {open && (
        <FriendProfile
          me={uid}
          friend={open}
          isBucket={isBucket}
          onClose={() => setOpen(null)}
          onRemoved={id => setList(l => ({ ...l, friends: l.friends.filter(x => x.id !== id) }))}
        />
      )}
    </section>
  )
}
