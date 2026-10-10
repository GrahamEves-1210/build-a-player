import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NameTag, AvatarBadge } from './NameTag'
import { IconClose, IconStar, IconRing, IconMedal, IconVersus, IconTrophy } from './icons'
import { loadPublicProfile, removeFriend, modeLabel } from '../../lib/friends'
import './friends.css'

// A friend's profile, as a sheet over Profile: their look (avatar + name
// decal), what's already public about them (seasons, rings, awards, 1v1 record,
// best saved builds), a way to play them, and Remove friend.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))

export default function FriendProfile({ me, friend, isBucket = false, onClose, onRemoved }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    let live = true
    setData(null); setFailed(false); setConfirm(false); setErr('')
    loadPublicProfile(friend.id).then(d => { if (live) { if (d) setData(d); else setFailed(true) } }, () => { if (live) setFailed(true) })
    return () => { live = false }
  }, [friend.id])

  const closeFn = useRef(onClose)
  closeFn.current = onClose
  useEffect(() => {
    const back = document.activeElement
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') closeFn.current() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus()
    }
  }, [])

  const name = data?.username || friend.username || 'Player'

  async function remove() {
    if (!confirm) { setConfirm(true); return }
    setBusy(true); setErr('')
    try {
      await removeFriend(me, friend.id)
      onRemoved?.(friend.id)
      onClose()
    } catch {
      setErr("Couldn't remove this friend. Try again in a moment.")
      setBusy(false); setConfirm(false)
    }
  }

  // The 1v1 lives on the Blacktop (Build-A-Bucket): Play a friend gives a room code to send them
  function play() { onClose(); nav('blacktop') }

  return createPortal(
    <div className="fr-overlay" onClick={onClose}>
      <div className="fr-sheet" role="dialog" aria-modal="true" aria-labelledby="fr-sheet-name" onClick={e => e.stopPropagation()}>
        <div className="fr-grab" aria-hidden="true" />
        <div className="fr-sheet-head">
          <span className="ag-eyebrow">FRIEND</span>
          <button ref={closeRef} className="fr-icon-btn" onClick={onClose} aria-label="Close friend profile"><IconClose size={18} /></button>
        </div>

        <div className="fr-hero">
          <AvatarBadge uid={friend.id} name={name} size={76} level={data?.level ?? null} />
          <div className="fr-hero-id">
            <span className="fr-hero-name" id="fr-sheet-name"><NameTag uid={friend.id} name={name} /></span>
            {data?.level != null && <span className="fr-hero-sub">LEVEL {data.level}</span>}
          </div>
        </div>

        <div className="fr-sheet-body">
          {failed && <p className="fr-note">Couldn't load this profile right now.</p>}
          {!failed && !data && <div className="fr-loading" aria-label="Loading profile"><span /><span /><span /></div>}
          {data && (
            <>
              <div className="fr-stats">
                <span><IconStar size={15} /><b>{data.seasons == null ? '–' : data.seasons.toLocaleString()}</b>SEASONS</span>
                <span><IconRing size={15} /><b>{data.rings == null ? '–' : data.rings.toLocaleString()}</b>RINGS</span>
                <span><IconMedal size={15} /><b>{data.awards.toLocaleString()}</b>AWARDS</span>
                <span><IconVersus size={15} /><b>{data.vsWins}-{data.vsLosses}</b>1V1</span>
              </div>

              <div className="fr-sub-head"><span className="ag-eyebrow">BEST BUILDS</span></div>
              {data.best.length === 0 && <p className="fr-note">No saved seasons yet.</p>}
              <div className="fr-builds">
                {data.best.map((b, i) => {
                  const names = [...new Set(Object.values(b.build || {}).map(d => d?.qb).filter(Boolean))].slice(0, 6)
                  return (
                    <div key={i} className={`fr-build${i === 0 ? ' is-top' : ''}`}>
                      <span className="fr-build-ovr"><b>{b.ovr ?? '–'}</b><small>OVR</small></span>
                      <span className="fr-build-main">
                        <span className="fr-build-mode">{modeLabel(b.game_mode, b.position)}</span>
                        {b.archetype && <span className="fr-build-arch">{b.archetype}</span>}
                        {names.length > 0 && <span className="fr-build-names">{names.join(' · ')}</span>}
                      </span>
                      <span className="fr-build-rec">
                        {b.wins != null && <b>{b.wins}-{b.losses ?? 0}</b>}
                        {b.champion && <i className="fr-ring" role="img" title="Champions" aria-label="Won the title"><IconTrophy size={13} /></i>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="fr-sheet-actions">
          {isBucket && (
            <button className="ag-btn fr-play" onClick={play}><IconVersus size={18} /> PLAY 1V1</button>
          )}
          {isBucket && <p className="fr-hint">On the Blacktop, pick Play a friend and send {name} your code.</p>}
          {err && <p className="fr-note fr-note--err" role="alert">{err}</p>}
          <button className={`fr-remove${confirm ? ' is-confirm' : ''}`} onClick={remove} disabled={busy}>
            {busy ? 'REMOVING…' : confirm ? `TAP AGAIN TO REMOVE ${name.toUpperCase()}` : 'REMOVE FRIEND'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
