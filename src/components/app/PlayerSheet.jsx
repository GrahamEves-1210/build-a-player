import { useEffect, useState } from 'react'
import FriendProfile from './FriendProfile'
import { useProgress } from '../../lib/progress'
import { getUsername } from '../../lib/discord'
import { relationWith, sendFriendRequest, respondToRequest } from '../../lib/friends'

// Any player's profile, from their name anywhere it shows (NameTag sends 'bap:player';
// AppTabBar opens this): FriendProfile with Add friend, Accept, or Remove friend for
// where we stand with them.

export default function PlayerSheet({ player, isBucket, onClose }) {
  const p = useProgress()
  const me = p.user?.id ?? null
  const [rel, setRel] = useState(null)      // { state, reqId }

  useEffect(() => {
    let live = true
    setRel(null)
    if (!me) { setRel({ state: 'guest' }); return }
    if (me === player.id) { setRel({ state: 'self' }); return }
    relationWith(me, player.id).then(r => { if (live) setRel(r) }, () => { if (live) setRel({ state: 'none', reqId: null }) })
    return () => { live = false }
  }, [me, player.id])

  return (
    <FriendProfile
      me={me}
      friend={{ id: player.id, username: player.username }}
      isBucket={isBucket}
      relation={rel?.state ?? null}
      onClose={onClose}
      onRemoved={() => setRel({ state: 'none', reqId: null })}
      onAdd={async () => { await sendFriendRequest(me, getUsername(p.user) || 'Player', { id: player.id, username: player.username }); setRel({ state: 'sent' }) }}
      onAccept={async () => { await respondToRequest(rel.reqId, true); setRel({ state: 'friends', reqId: rel.reqId }) }}
    />
  )
}
