import { useState, useRef, useEffect } from 'react'
import { supabase, rtSupabase } from '../lib/supabase'
import Navbar from './Navbar'

const rt = rtSupabase || supabase

const HoopU = () => (
  <svg className="hoop-u-svg" viewBox="0 0 68 90" fill="none" aria-hidden="true">
    <circle cx="34" cy="14" r="14.4" fill="#f97316"/>
    <path d="M8 24 L18 88 L50 88 L60 24" stroke="white" strokeWidth="6" strokeLinejoin="round" fill="none"/>
    <line x1="17" y1="25" x2="38" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="27" y1="25" x2="48" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="41" y1="25" x2="20" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="51" y1="25" x2="30" y2="88" stroke="white" strokeWidth="3.5"/>
    <line x1="5" y1="26" x2="63" y2="26" stroke="white" strokeWidth="5" strokeLinecap="round"/>
  </svg>
)

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

let _vsId = null
export function getVsId() {
  if (_vsId) return _vsId
  _vsId = sessionStorage.getItem('bap_vs_id')
  if (!_vsId) {
    _vsId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('bap_vs_id', _vsId)
  }
  return _vsId
}

export default function VersusLobby({ onJoin, position, gameMode, onBack, onLeaderboard, onSignIn, onProfile, onAbout, onSwitchBucketPosition, user, vsRecord, channelPrefix = 'bap' }) {
  const [screen, setScreen]       = useState('menu')
  const [myCode, setMyCode]       = useState('')
  const [inputCode, setInputCode] = useState('')
  const [status, setStatus]       = useState('')
  const [error, setError]         = useState('')
  const [lbOpen, setLbOpen]       = useState(false)
  const [lbTab, setLbTab]         = useState('record')
  const [lbRows, setLbRows]       = useState([])
  const [lbLoading, setLbLoading] = useState(true)
  const [searchSecs, setSearchSecs]   = useState(0)
  const [queueSize, setQueueSize]     = useState(0)
  const [activityRate, setActivityRate] = useState(null) // users/min in last 30 min, null = loading
  const searchTimerRef = useRef(null)

  // ── Friends ──────────────────────────────────────────────────────────────────
  const [friendsOpen, setFriendsOpen]           = useState(false)
  const [friendSearch, setFriendSearch]         = useState('')
  const [friendSearchResult, setFriendSearchResult] = useState(null)
  const [friendSearchMsg, setFriendSearchMsg]   = useState('')
  const [friendRequests, setFriendRequests]     = useState([])
  const [friends, setFriends]                   = useState([])
  const [pendingInvites, setPendingInvites]     = useState([])
  const [friendsLoading, setFriendsLoading]     = useState(false)
  const [challengeSentTo, setChallengeSentTo]   = useState(null)
  const chRef  = useRef(null)
  const bcRef  = useRef(null)
  const myId   = user?.id ? `${user.id}-${getVsId()}` : getVsId()

  useEffect(() => {
    supabase.from('vs_results').select('user_id, username, result, ovr, match_type')
      .or('match_type.eq.pickup,match_type.is.null')
      .then(({ data }) => {
        if (!data) { setLbLoading(false); return }
        const byUser = {}
        data.forEach(r => {
          if (!byUser[r.user_id]) byUser[r.user_id] = { username: r.username, wins: 0, losses: 0, ovrs: [] }
          if (r.result === 'win') byUser[r.user_id].wins++
          if (r.result === 'loss' || r.result === 'forfeit') byUser[r.user_id].losses++
          // Exclude forfeits from OVR average — incomplete builds give falsely low values
          if (r.result !== 'forfeit' && r.ovr != null && r.ovr > 0) byUser[r.user_id].ovrs.push(Number(r.ovr))
        })
        const rows = Object.values(byUser).map(u => ({
          username: u.username,
          wins: u.wins,
          losses: u.losses,
          winPct: u.wins + u.losses > 0 ? ((u.wins / (u.wins + u.losses)) * 100).toFixed(1) : null,
          avgOvr: u.ovrs.length > 0 ? (u.ovrs.reduce((a, b) => a + b, 0) / u.ovrs.length).toFixed(1) : null,
        }))
        setLbRows(rows)
        setLbLoading(false)
      })
  }, [])

  function makeChannel(name) {
    return rt.channel(name, { config: { presence: { key: myId } } })
  }
  const myName = user?.user_metadata?.username || user?.email?.split('@')[0] || null

  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'versus-lobby')
    return () => document.documentElement.removeAttribute('data-page')
  }, [])

  useEffect(() => () => { abandon() }, [])

  function abandon() {
    if (chRef.current) { rt.removeChannel(chRef.current); chRef.current = null }
    if (bcRef.current) { bcRef.current.close(); bcRef.current = null }
  }

  // Wraps a BroadcastChannel in a Supabase-channel-compatible interface
  // so in-game send/on calls work transparently for both paths.
  function wrapBC(bc) {
    const handlers = {}
    bc.onmessage = (e) => {
      const { type, event, payload } = e.data || {}
      if (type === 'broadcast' && event && handlers[event]) {
        handlers[event].forEach(fn => fn({ payload }))
      }
    }
    return {
      _bc: bc,
      on(type, filter, callback) {
        if (type === 'broadcast' && filter?.event) {
          if (!handlers[filter.event]) handlers[filter.event] = []
          handlers[filter.event].push(callback)
        }
        return this
      },
      send(msg) {
        try { bc.postMessage(msg) } catch {}
        return Promise.resolve()
      },
      subscribe(cb) {
        if (cb) Promise.resolve().then(() => cb('SUBSCRIBED'))
        return this
      },
      close() { try { bc.close() } catch {} },
    }
  }

  // Opens a BroadcastChannel fallback when Supabase Realtime can't connect.
  // Calls onMatch when the other side announces itself.
  function openBC(chName, onMatch) {
    if (bcRef.current) return
    const bc = new BroadcastChannel(chName)
    bcRef.current = bc
    bc.postMessage({ vid: myId, name: myName })
    bc.onmessage = (e) => {
      if (!e.data?.vid || e.data.vid === myId) return
      bc.postMessage({ vid: myId, name: myName })
      onMatch(e.data, bc)
    }
  }

  // ── HOST friend room ────────────────────────────────────────────────────────
  async function hostFriend() {
    const code = genCode()
    setMyCode(code)
    setScreen('host')
    setStatus('Waiting for friend…')

    const chName = `${channelPrefix}-vs-${code}`
    const ch = makeChannel(chName)
    chRef.current = ch
    let matched = false

    function matchWith(opp, bc) {
      if (matched) return
      matched = true
      // Remove the presence channel and create a fresh game channel so
      // handleVersusJoin can subscribe it cleanly (same pattern as random matchmaking).
      let gameChannel
      if (bc) {
        bcRef.current = null
        gameChannel = wrapBC(bc)
      } else {
        rt.removeChannel(ch)
        chRef.current = null
        gameChannel = rt.channel(chName + '-g')
      }
      setStatus('Opponent connected!')
      setTimeout(() => onJoin({ code, role: 'host', oppId: opp.vid, oppName: opp.name, channel: gameChannel, matchType: 'friend' }), 500)
    }

    ch.on('presence', { event: 'sync' }, () => {
      if (matched) return
      const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
      if (opp) matchWith(opp, null)
    })

    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        await ch.track({ vid: myId, name: myName })
        if (!matched) {
          const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
          if (opp) matchWith(opp, null)
        }
      } else if (s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') {
        openBC(chName, matchWith)
      }
    })
  }

  // ── JOIN friend room ────────────────────────────────────────────────────────
  async function joinFriend() {
    const code = inputCode.trim().toUpperCase()
    if (code.length < 4) { setError('Enter a valid code'); return }
    setError('')
    setScreen('joining')
    setStatus('Connecting…')

    const chName = `${channelPrefix}-vs-${code}`
    const ch = makeChannel(chName)
    chRef.current = ch
    let done = false
    let trackDone = false  // guard: don't run matchWith before track completes

    function matchWith(opp, bc) {
      if (done) return
      done = true
      let gameChannel
      if (bc) {
        bcRef.current = null
        gameChannel = wrapBC(bc)
      } else {
        rt.removeChannel(ch)
        chRef.current = null
        gameChannel = rt.channel(chName + '-g')
      }
      setStatus('Connected!')
      setTimeout(() => onJoin({ code, role: 'guest', oppId: opp.vid, oppName: opp.name, channel: gameChannel, matchType: 'friend' }), 500)
    }

    // Block sync until after track is acknowledged — the initial presence_state fires
    // before we've tracked, so the host wouldn't see us yet; we'd removeChannel too early
    // and the host would never detect us.
    ch.on('presence', { event: 'sync' }, () => {
      if (done || !trackDone) return
      const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
      if (opp) matchWith(opp, null)
    })

    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        await ch.track({ vid: myId, name: myName })
        trackDone = true
        // Check immediately after track — host may already be present
        if (!done) {
          const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
          if (opp) matchWith(opp, null)
        }
      } else if (s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') {
        openBC(chName, matchWith)
        setTimeout(() => { if (!done && bcRef.current) bcRef.current.postMessage({ vid: myId, name: myName }) }, 500)
      }
    })

    setTimeout(() => {
      if (!done) { setError('Room not found — check the code.'); setScreen('menu'); abandon() }
    }, 25000)
  }

  function etaLabel(secs, qSize, rate) {
    if (qSize >= 2) return 'Opponent found — connecting…'
    if (rate === null) return 'Checking queue activity…'
    // rate = unique users/min in last 30 min (proxy for arrival rate)
    // expected wait ≈ 1 / rate minutes; clamp to sensible display
    if (rate === 0) {
      if (secs < 10) return 'You may be the first one here — hang tight'
      return 'Very quiet right now · Wait or try later'
    }
    const estWaitMin = 1 / rate // minutes until someone likely joins
    if (estWaitMin < 0.5) return `Est. wait: ~${Math.round(estWaitMin * 60)}s`
    if (estWaitMin < 2)   return `Est. wait: ~${Math.round(estWaitMin)} min`
    if (estWaitMin < 5)   return `Est. wait: ${Math.floor(estWaitMin)}–${Math.ceil(estWaitMin)} min · Low traffic`
    return `Slow queue · Est. ${Math.round(estWaitMin)} min wait`
  }

  // ── RANDOM matchmaking ──────────────────────────────────────────────────────
  async function findRandom() {
    setScreen('searching')
    setStatus('Finding opponent…')
    setSearchSecs(0)
    setQueueSize(1)
    setActivityRate(null)
    clearInterval(searchTimerRef.current)
    searchTimerRef.current = setInterval(() => setSearchSecs(s => s + 1), 1000)

    // Fetch recent match activity to estimate queue wait
    supabase.from('vs_results')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .then(({ data }) => {
        if (!data) { setActivityRate(0); return }
        const uniqueUsers = new Set(data.map(r => r.user_id)).size
        setActivityRate(uniqueUsers / 30) // unique active users per minute
      })

    const queueName = `${channelPrefix}-vs-q-${gameMode}`
    const ch = makeChannel(queueName)
    chRef.current = ch
    let done = false
    let heartbeatTimer = null
    const seen = new Set() // vids we've already tried to match

    async function claimRoom(code, role, oppId, oppName) {
      done = true
      clearInterval(searchTimerRef.current)
      clearInterval(heartbeatTimer)
      setStatus('Match found!')
      rt.removeChannel(ch)
      chRef.current = null  // clear so abandon() on unmount is a no-op

      // Create game channel but do NOT subscribe here — handleVersusJoin will
      // register .on() handlers first, then subscribe (correct Supabase order).
      // Also don't store in chRef so abandon() can't kill it on VersusLobby unmount.
      const roomCh = rt.channel(`${channelPrefix}-vs-${code}`)
      setTimeout(() => onJoin({ code, role, oppId, oppName, channel: roomCh, matchType: 'pickup' }), 800)
    }

    // Guest: receive match packet from host
    ch.on('broadcast', { event: 'bab_match' }, ({ payload }) => {
      if (done || (payload.h !== myId && payload.g !== myId)) return
      const role   = payload.h === myId ? 'host' : 'guest'
      const oppId  = role === 'host' ? payload.g : payload.h
      const oppName = role === 'host' ? payload.gn : payload.hn
      claimRoom(payload.code, role, oppId, oppName)
    })

    // Receive heartbeats from other searching players
    ch.on('broadcast', { event: 'bab_queue' }, async ({ payload }) => {
      if (done || !payload?.vid || payload.vid === myId) return
      if (seen.has(payload.vid)) return
      seen.add(payload.vid)
      setQueueSize(s => Math.max(s, 2))
      // Lower vid becomes host to avoid both sides trying to match simultaneously
      if (myId.localeCompare(payload.vid) < 0) {
        const code = genCode()
        await ch.send({ type: 'broadcast', event: 'bab_match', payload: { code, h: myId, hn: myName, g: payload.vid, gn: payload.name } })
        claimRoom(code, 'host', payload.vid, payload.name)
      }
    })

    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        // Broadcast presence immediately, then every 3s so late joiners find us
        const announce = () => { if (!done) ch.send({ type: 'broadcast', event: 'bab_queue', payload: { vid: myId, name: myName } }).catch(() => {}) }
        announce()
        heartbeatTimer = setInterval(announce, 3000)
      }
      else if (s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') {
        // BC fallback for local/same-origin testing (two tabs)
        const bcQ = new BroadcastChannel(queueName)
        bcRef.current = bcQ
        bcQ.onmessage = (e) => {
          if (done) return
          const d = e.data
          // Guest: received a match packet the host addressed to us
          if (d?.match && (d.match.h === myId || d.match.g === myId)) {
            done = true
            clearInterval(searchTimerRef.current)
            const m = d.match
            const role = m.h === myId ? 'host' : 'guest'
            const oppId = role === 'host' ? m.g : m.h
            const oppName = role === 'host' ? m.gn : m.hn
            bcQ.close(); bcRef.current = null
            onJoin({ code: m.code, role, oppId, oppName, channel: wrapBC(new BroadcastChannel(`${channelPrefix}-vs-${m.code}`)), matchType: 'pickup' })
            return
          }
          // Received a "looking" announcement — lower ID is host, higher ID waits for match packet
          if (d?.vid && d.vid !== myId) {
            if (myId.localeCompare(d.vid) < 0) {
              // I am host: generate code, notify guest, start game
              const code = genCode()
              const m = { code, h: myId, hn: myName, g: d.vid, gn: d.name }
              done = true
              clearInterval(searchTimerRef.current)
              bcQ.postMessage({ match: m })
              bcQ.close(); bcRef.current = null
              onJoin({ code, role: 'host', oppId: d.vid, oppName: d.name, channel: wrapBC(new BroadcastChannel(`${channelPrefix}-vs-${code}`)), matchType: 'pickup' })
            }
            // Guest: do nothing here, wait for the match packet the host will send
          }
        }
        bcQ.postMessage({ vid: myId, name: myName })
      }
    })
  }

  // ── Friend system ───────────────────────────────────────────────────────────
  async function loadFriends() {
    if (!user?.id) return
    setFriendsLoading(true)
    const uid = user.id

    const [reqRes, accRes, invRes] = await Promise.all([
      supabase.from('friend_requests').select('*').eq('to_id', uid).eq('status', 'pending'),
      supabase.from('friend_requests').select('*').or(`from_id.eq.${uid},to_id.eq.${uid}`).eq('status', 'accepted'),
      supabase.from('vs_invites').select('*').eq('to_id', uid).eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()),
    ])
    console.log('[friends] incoming requests:', reqRes.data, reqRes.error)
    console.log('[friends] accepted:', accRes.data, accRes.error)
    console.log('[friends] invites:', invRes.data, invRes.error)
    const { data: incoming } = reqRes
    const { data: accepted } = accRes
    const { data: invites }  = invRes

    const enriched = await Promise.all((accepted || []).map(async f => {
      const fid  = f.from_id === uid ? f.to_id       : f.from_id
      const name = f.from_id === uid ? f.to_username  : f.from_username
      const { data: res } = await supabase.from('vs_results').select('result').eq('user_id', fid)
      const wins   = (res || []).filter(r => r.result === 'win').length
      const losses = (res || []).filter(r => r.result === 'loss' || r.result === 'forfeit').length
      return { id: fid, username: name, wins, losses, reqId: f.id }
    }))

    setFriendRequests(incoming || [])
    setFriends(enriched)
    setPendingInvites(invites || [])
    setFriendsLoading(false)
  }

  useEffect(() => {
    if (!user?.id) return
    loadFriends()
  }, [user?.id])

  useEffect(() => {
    if (!friendsOpen || !user?.id) return
    loadFriends()
    const interval = setInterval(loadFriends, 5000)
    return () => clearInterval(interval)
  }, [friendsOpen, user?.id])

  async function searchFriendUser() {
    const q = friendSearch.trim()
    if (!q) return
    setFriendSearchResult(null)
    setFriendSearchMsg('Searching…')
    const { data } = await supabase.from('accounts').select('id, username').ilike('username', q).limit(1)
    if (!data?.length) { setFriendSearchMsg('No user found'); return }
    const found = { user_id: data[0].id, username: data[0].username }
    if (found.user_id === user?.id) { setFriendSearchMsg("That's you"); return }
    const { data: existing } = await supabase.from('friend_requests').select('id,status')
      .or(`and(from_id.eq.${user.id},to_id.eq.${found.user_id}),and(from_id.eq.${found.user_id},to_id.eq.${user.id})`).limit(1)
    if (existing?.length) {
      setFriendSearchMsg(existing[0].status === 'accepted' ? 'Already friends' : 'Request already sent')
      return
    }
    setFriendSearchResult(found)
    setFriendSearchMsg('')
  }

  async function sendFriendRequest(target) {
    const { error: insErr } = await supabase.from('friend_requests').insert({
      from_id: user.id, from_username: myName,
      to_id: target.user_id, to_username: target.username, status: 'pending',
    })
    console.log('[friends] insert result:', insErr)
    if (insErr) { setFriendSearchMsg(`Error: ${insErr.message}`); return }
    setFriendSearchResult(null)
    setFriendSearch('')
    setFriendSearchMsg('Request sent!')
  }

  async function respondToRequest(reqId, accept) {
    await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', reqId)
    loadFriends()
  }

  async function challengeFriend(friend) {
    const code = genCode()
    setChallengeSentTo(friend.id)
    await supabase.from('vs_invites').insert({
      from_id: user.id, from_username: myName,
      to_id: friend.id, room_code: code, status: 'pending',
    })
    setMyCode(code)
    setScreen('host')
    setFriendsOpen(false)
    setStatus(`Challenge sent to ${friend.username}…`)
    const chName = `${channelPrefix}-vs-${code}`
    const ch = makeChannel(chName)
    chRef.current = ch
    let matched = false
    ch.on('presence', { event: 'sync' }, () => {
      const state = Object.values(ch.presenceState()).flat()
      if (matched) return
      const opp = state.find(u => u.vid !== myId)
      if (!opp) return
      matched = true
      rt.removeChannel(ch)
      chRef.current = null
      const gameChannel = rt.channel(chName + '-g')
      setStatus(`${friend.username} joined!`)
      setTimeout(() => onJoin({ code, role: 'host', oppId: opp.vid, oppName: opp.name, channel: gameChannel, matchType: 'friend' }), 500)
    })
    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        await ch.track({ vid: myId, name: myName })
        if (!matched) {
          const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
          if (opp) matchWith(opp, null)
        }
      } else if (s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') openBC(chName, (opp, bc) => {
        if (matched) return
        matched = true
        rt.removeChannel(ch)
        chRef.current = null
        const gameChannel = bc ? (bcRef.current = null, wrapBC(bc)) : rt.channel(chName)
        setTimeout(() => onJoin({ code, role: 'host', oppId: opp.vid, oppName: opp.name, channel: gameChannel, matchType: 'friend' }), 500)
      })
    })
  }

  async function acceptChallenge(invite) {
    console.log('[accept] invite:', invite)
    const { error: updErr } = await supabase.from('vs_invites').update({ status: 'accepted' }).eq('id', invite.id)
    console.log('[accept] update error:', updErr)
    setFriendsOpen(false)
    const code    = invite.room_code
    const chName  = `${channelPrefix}-vs-${code}`
    console.log('[accept] joining channel:', chName)
    const ch      = makeChannel(chName)
    chRef.current = ch
    setScreen('joining')
    setStatus(`Joining ${invite.from_username}'s game…`)
    let done = false
    let trackDone = false
    function matchWith(opp, bc) {
      if (done) return
      done = true
      let gameChannel
      if (bc) {
        bcRef.current = null
        chRef.current = null
        gameChannel = wrapBC(bc)
      } else {
        rt.removeChannel(ch)
        chRef.current = null
        gameChannel = rt.channel(chName + '-g')
      }
      setStatus('Connected!')
      setTimeout(() => onJoin({ code, role: 'guest', oppId: opp.vid, oppName: opp.name, channel: gameChannel, matchType: 'friend' }), 500)
    }
    ch.on('presence', { event: 'sync' }, () => {
      if (done || !trackDone) return
      const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
      if (opp) matchWith(opp, null)
    })
    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') {
        await ch.track({ vid: myId, name: myName })
        trackDone = true
        if (!done) {
          const opp = Object.values(ch.presenceState()).flat().find(u => u.vid !== myId)
          if (opp) matchWith(opp, null)
        }
      } else if (s === 'TIMED_OUT' || s === 'CHANNEL_ERROR') {
        openBC(chName, matchWith)
        setTimeout(() => { if (!done && bcRef.current) bcRef.current.postMessage({ vid: myId, name: myName }) }, 500)
      }
    })
    setTimeout(() => { if (!done) { setError('Invite expired.'); setScreen('menu'); abandon() } }, 30000)
  }

  const notifCount = friendRequests.length + pendingInvites.length

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="versus-lobby">
      <Navbar
        isBucket
        gameMode="versus"
        user={user}
        onSignIn={onSignIn}
        onHome={() => { abandon(); onBack() }}
        onProfile={onProfile}
        onAbout={onAbout}
        onLeaderboard={onLeaderboard}
      />

      <div className="versus-lobby-hero">
        <div className="versus-lobby-title">HEAD<span className="h2h-to">-TO-</span>HEAD</div>
        <div className="versus-lobby-modes">
          <div className="vlm-spacer" />
          <div className="vlm-pills">
            <button className="vlm-btn vlm-btn--active">1v1</button>
            <button className="vlm-btn vlm-btn--soon" disabled>
              <span className="vlm-soon-label">COMING SOON</span>
              3v3
            </button>
          </div>
          <div className="vlm-right">
            <button className="vlm-friends-btn" onClick={() => setLbOpen(v => !v)} title="Leaderboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </button>
            <button className="vlm-friends-btn" onClick={() => setFriendsOpen(v => !v)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {notifCount > 0 && <span className="vlm-fb-badge">{notifCount}</span>}
            </button>
          </div>
        </div>
        <div className="versus-lobby-sub">Build your player · Face off</div>
        <div className="vlh-stat-card">
          <div className="vlh-stat-left">
            <div className="vlh-stat-name">
              {user ? (user.user_metadata?.username || user.email?.split('@')[0]) : 'Sign in to track stats'}
            </div>
          </div>
          <div className="vlh-stat-record">
            <div className="vlh-stat-col">
              <span className="vlh-stat-num">{user ? (vsRecord?.wins ?? 0) : '—'}</span>
              <span className="vlh-stat-label">W</span>
            </div>
            <span className="vlh-stat-sep">–</span>
            <div className="vlh-stat-col">
              <span className="vlh-stat-num vlh-stat-num--l">{user ? (vsRecord?.losses ?? 0) : '—'}</span>
              <span className="vlh-stat-label">L</span>
            </div>
          </div>
        </div>
      </div>

      {screen === 'menu' && (
        <div className="versus-menu">
          <button className="versus-mode-btn versus-mode-btn--quick" onClick={findRandom}>
            <img src="/bbicon.png" alt="" style={{width:42,height:42,objectFit:'contain',flexShrink:0,marginLeft:-9}} />
            <div>
              <div className="vmb-title">PICKUP</div>
              <div className="vmb-sub">Play a random opponent</div>
            </div>
          </button>

          <button className="versus-mode-btn versus-mode-btn--friend" onClick={hostFriend}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <div style={{marginLeft:10}}>
              <div className="vmb-title">CREATE ROOM</div>
              <div className="vmb-sub">Get a code to share</div>
            </div>
          </button>

          <div className="versus-divider"><span>or join with a code</span></div>

          <div className="versus-join-row">
            <input
              className="versus-code-input"
              placeholder="ENTER CODE"
              value={inputCode}
              maxLength={8}
              onChange={e => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && joinFriend()}
            />
            <button className="versus-join-btn" onClick={joinFriend}>JOIN</button>
          </div>

          {error && <div className="versus-error">{error}</div>}

        </div>
      )}

      {(screen === 'host' || screen === 'joining' || screen === 'searching') && (
        <div className="versus-waiting">
          {screen === 'host' && (
            <div className="versus-code-block">
              <div className="vcb-label">Share this code</div>
              <div className="vcb-code">{myCode}</div>
              <button
                className="vcb-copy"
                onClick={() => navigator.clipboard?.writeText(myCode)}
              >Copy</button>
            </div>
          )}
          <div className="versus-wait-status">{status}</div>
          <div className="versus-dots"><span /><span /><span /></div>
          {screen === 'searching' && (
            <div className="versus-search-meta">
              <span className="vsm-timer">{String(Math.floor(searchSecs / 60)).padStart(2,'0')}:{String(searchSecs % 60).padStart(2,'0')}</span>
              <span className="vsm-eta">{etaLabel(searchSecs, queueSize, activityRate)}</span>
            </div>
          )}
          {error && <div className="versus-error">{error}</div>}
          <button className="versus-cancel" onClick={() => { clearInterval(searchTimerRef.current); abandon(); setScreen('menu'); setError('') }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Leaderboard panel ───────────────────────────────────────────────── */}
      {lbOpen && (
        <>
          <div className="vlf-backdrop" onClick={() => setLbOpen(false)} />
          <div className="vlf-panel">
            <div className="vlf-header">
              <span className="vlf-header-title">LEADERBOARD</span>
              <button className="vlf-close" onClick={() => setLbOpen(false)}>×</button>
            </div>
            <div className="vlf-body">
              <div className="vlh-lb-tabs" style={{marginBottom:8}}>
                <button className={`vlh-lb-tab${lbTab === 'record' ? ' vlh-lb-tab--active' : ''}`} onClick={() => setLbTab('record')}>RECORD</button>
                <button className={`vlh-lb-tab${lbTab === 'ovr' ? ' vlh-lb-tab--active' : ''}`} onClick={() => setLbTab('ovr')}>AVG OVR</button>
              </div>
              {lbLoading ? (
                <div className="vlh-lb-loading"><div className="versus-dots"><span/><span/><span/></div></div>
              ) : (
                <div className="vlh-lb-table">
                  <div className="vlh-lb-thead">
                    <span className="vlh-lb-th vlh-lb-th--rank">#</span>
                    <span className="vlh-lb-th vlh-lb-th--name">Player</span>
                    {lbTab === 'record'
                      ? <span className="vlh-lb-th vlh-lb-th--right">W-L <span className="vlh-lb-th-sub">WIN%</span></span>
                      : <span className="vlh-lb-th vlh-lb-th--right">OVR</span>
                    }
                  </div>
                  {(() => {
                    const sorted = lbTab === 'record'
                      ? [...lbRows].sort((a, b) => b.wins - a.wins)
                      : [...lbRows].sort((a, b) => (b.avgOvr ?? 0) - (a.avgOvr ?? 0))
                    const padded = [...sorted, ...Array(Math.max(0, 20 - sorted.length)).fill(null)]
                    return padded.slice(0, 20).map((r, i) => (
                      <div key={i} className={`vlh-lb-row${!r ? ' vlh-lb-row--empty' : ''}`}>
                        <span className="vlh-lb-td vlh-lb-td--rank">{r ? i + 1 : ''}</span>
                        <span className="vlh-lb-td vlh-lb-td--name">{r?.username || ''}</span>
                        {lbTab === 'record'
                          ? <span className="vlh-lb-td vlh-lb-td--right">
                              {r ? <>{r.wins}–{r.losses} <span className="vlh-lb-pct">{r.winPct != null ? `${r.winPct}%` : '—'}</span></> : ''}
                            </span>
                          : <span className="vlh-lb-td vlh-lb-td--right">{r?.avgOvr ?? ''}</span>
                        }
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Friend panel ────────────────────────────────────────────────────── */}
      {friendsOpen && (
        <>
          <div className="vlf-backdrop" onClick={() => setFriendsOpen(false)} />
          <div className="vlf-panel">
            <div className="vlf-header">
              <span className="vlf-header-title">FRIENDS</span>
              <button className="vlf-close" onClick={() => setFriendsOpen(false)}>×</button>
            </div>

            <div className="vlf-body">
              {!user && <div className="vlf-status-msg" style={{color:'rgba(255,255,255,0.5)'}}>Sign in to use friends & challenges.</div>}
              {/* Incoming 1v1 challenges */}
              {pendingInvites.length > 0 && (
                <div>
                  <div className="vlf-section-label">CHALLENGES</div>
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="vlf-invite-card">
                      <div>
                        <div className="vlf-invite-name">{inv.from_username}</div>
                        <div className="vlf-invite-sub">challenged you to 1v1</div>
                      </div>
                      <button className="vlf-accept-btn" onClick={() => acceptChallenge(inv)}>ACCEPT</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Send friend request */}
              <div>
                <div className="vlf-section-label">ADD FRIEND</div>
                <div className="vlf-search-row">
                  <input
                    className="vlf-search-input"
                    placeholder="Search username…"
                    value={friendSearch}
                    onChange={e => { setFriendSearch(e.target.value); setFriendSearchResult(null); setFriendSearchMsg('') }}
                    onKeyDown={e => e.key === 'Enter' && searchFriendUser()}
                  />
                  <button className="vlf-search-btn" onClick={searchFriendUser}>FIND</button>
                </div>
                {friendSearchMsg && <div className="vlf-status-msg">{friendSearchMsg}</div>}
                {friendSearchResult && (
                  <div className="vlf-search-result">
                    <span className="vlf-req-name">{friendSearchResult.username}</span>
                    <button className="vlf-accept-btn" onClick={() => sendFriendRequest(friendSearchResult)}>ADD</button>
                  </div>
                )}
              </div>

              {/* Incoming friend requests */}
              {friendRequests.length > 0 && (
                <div>
                  <div className="vlf-section-label">REQUESTS</div>
                  {friendRequests.map(req => (
                    <div key={req.id} className="vlf-request-row">
                      <span className="vlf-req-name">{req.from_username}</span>
                      <button className="vlf-req-accept" onClick={() => respondToRequest(req.id, true)}>✓</button>
                      <button className="vlf-req-decline" onClick={() => respondToRequest(req.id, false)}>✗</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Friends list */}
              <div>
                <div className="vlf-section-label">FRIENDS {friends.length > 0 && `· ${friends.length}`}</div>
                {friendsLoading && <div className="vlf-status-msg">Loading…</div>}
                {!friendsLoading && friends.length === 0 && <div className="vlf-status-msg">No friends yet — add someone above</div>}
                {friends.map(f => (
                  <div key={f.id} className="vlf-friend-row">
                    <div className="vlf-friend-name">{f.username}</div>
                    <div className="vlf-friend-record">{f.wins}W–{f.losses}L</div>
                    <button
                      className="vlf-challenge-btn"
                      disabled={challengeSentTo === f.id}
                      onClick={() => challengeFriend(f)}
                    >
                      {challengeSentTo === f.id ? 'SENT' : '1v1'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
