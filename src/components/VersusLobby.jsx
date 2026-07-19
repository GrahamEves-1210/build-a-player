import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

function makeChannel(name) {
  return supabase.channel(name, { config: { presence: { key: '' } } })
}

export default function VersusLobby({ onJoin, position, gameMode, onBack, user, channelPrefix = 'bap' }) {
  const [screen, setScreen]       = useState('menu')
  const [myCode, setMyCode]       = useState('')
  const [inputCode, setInputCode] = useState('')
  const [status, setStatus]       = useState('')
  const [error, setError]         = useState('')
  const chRef = useRef(null)
  const myId   = user?.id ? `${user.id}-${getVsId()}` : getVsId()
  const myName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player'

  useEffect(() => () => { if (chRef.current) supabase.removeChannel(chRef.current) }, [])

  function abandon() {
    if (chRef.current) { supabase.removeChannel(chRef.current); chRef.current = null }
  }

  // ── HOST friend room ────────────────────────────────────────────────────────
  async function hostFriend() {
    const code = genCode()
    setMyCode(code)
    setScreen('host')
    setStatus('Waiting for friend…')

    const ch = makeChannel(`${channelPrefix}-vs-${code}`)
    chRef.current = ch

    ch.on('presence', { event: 'sync' }, () => {
      const all = Object.values(ch.presenceState()).flat()
      const opp = all.find(u => u.vid !== myId)
      if (opp) {
        setStatus('Opponent connected!')
        setTimeout(() => onJoin({ code, role: 'host', oppId: opp.vid, oppName: opp.name, channel: ch }), 500)
      }
    })

    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') await ch.track({ vid: myId, name: myName })
    })
  }

  // ── JOIN friend room ────────────────────────────────────────────────────────
  async function joinFriend() {
    const code = inputCode.trim().toUpperCase()
    if (code.length < 4) { setError('Enter a valid code'); return }
    setError('')
    setScreen('joining')
    setStatus('Connecting…')

    const ch = makeChannel(`${channelPrefix}-vs-${code}`)
    chRef.current = ch
    let done = false

    ch.on('presence', { event: 'sync' }, () => {
      if (done) return
      const all = Object.values(ch.presenceState()).flat()
      const opp = all.find(u => u.vid !== myId)
      if (opp) {
        done = true
        setStatus('Connected!')
        setTimeout(() => onJoin({ code, role: 'guest', oppId: opp.vid, oppName: opp.name, channel: ch }), 500)
      }
    })

    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') await ch.track({ vid: myId, name: myName })
    })

    setTimeout(() => {
      if (!done) { setError('Room not found — check the code.'); setScreen('menu'); abandon() }
    }, 10000)
  }

  // ── RANDOM matchmaking ──────────────────────────────────────────────────────
  async function findRandom() {
    setScreen('searching')
    setStatus('Finding opponent…')

    const queueName = `${channelPrefix}-vs-q-${position}-${gameMode}`
    const ch = makeChannel(queueName)
    chRef.current = ch
    let done = false

    async function claimRoom(code, role, oppId, oppName) {
      done = true
      setStatus('Match found!')
      supabase.removeChannel(ch)
      chRef.current = null

      const roomCh = makeChannel(`${channelPrefix}-vs-${code}`)
      chRef.current = roomCh
      roomCh.subscribe(async s => {
        if (s === 'SUBSCRIBED') {
          await roomCh.track({ vid: myId, name: myName })
          setTimeout(() => onJoin({ code, role, oppId, oppName, channel: roomCh }), 500)
        }
      })
    }

    ch.on('broadcast', { event: 'match' }, ({ payload }) => {
      if (done || (payload.h !== myId && payload.g !== myId)) return
      const role    = payload.h === myId ? 'host' : 'guest'
      const oppId   = role === 'host' ? payload.g : payload.h
      const oppName = role === 'host' ? payload.gn : payload.hn
      claimRoom(payload.code, role, oppId, oppName)
    })

    ch.on('presence', { event: 'sync' }, async () => {
      if (done) return
      const all    = Object.values(ch.presenceState()).flat()
      if (all.length < 2) return
      const sorted = [...all].sort((a, b) => a.vid.localeCompare(b.vid))
      if (sorted[0].vid !== myId) return
      const opp = sorted.find(u => u.vid !== myId)
      if (!opp) return
      const code = genCode()
      await ch.send({ type: 'broadcast', event: 'match', payload: { code, h: myId, hn: myName, g: opp.vid, gn: opp.name } })
      claimRoom(code, 'host', opp.vid, opp.name)
    })

    ch.subscribe(async s => {
      if (s === 'SUBSCRIBED') await ch.track({ vid: myId, name: myName })
    })
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="versus-lobby">
      <button className="versus-back" onClick={() => { abandon(); onBack() }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back
      </button>

      <div className="versus-lobby-hero">
        <div className="versus-lobby-title">
          1<span className="vlt-v">V</span>1
        </div>
        <div className="versus-lobby-sub">Build your {position.toUpperCase()} · Face off · Win</div>
      </div>

      {screen === 'menu' && (
        <div className="versus-menu">
          <button className="versus-mode-btn versus-mode-btn--quick" onClick={findRandom}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <div>
              <div className="vmb-title">QUICK MATCH</div>
              <div className="vmb-sub">Play a random opponent</div>
            </div>
          </button>

          <button className="versus-mode-btn versus-mode-btn--friend" onClick={hostFriend}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <div>
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

          <div className="versus-coming-soon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            5v5 mode coming soon
          </div>
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
          {error && <div className="versus-error">{error}</div>}
          <button className="versus-cancel" onClick={() => { abandon(); setScreen('menu'); setError('') }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
