// DEV ONLY (AppBlacktop mounts it behind import.meta.env.DEV, so it never ships): the lobby half of
// Blacktop on made-up data. Nothing here touches the live server, an account or a record: the
// seats, the chat and the buttons only change this page's own state.
//   /bucket?btlobby=hub        the hub with live games, players searching and a notice (&empty=1: a quiet night)
//   /bucket?btlobby=queue      the 3v3 lobby, partly filled, seated   (&size=1|2|3, &open=1: not seated yet, &bumped=1, &link=local|connecting)
//   /bucket?btlobby=full       the lobby with every spot taken (the tip-off state)   (&size=1|2|3)
//   /bucket?btlobby=chat       the lobby chat with messages   (&empty=1, &rules=1: before the rules are agreed)
//   /bucket?btlobby=teamchat   the team chat over a build (the squad strip)
//   /bucket?btlobby=v1menu | v1host | v1search | v1found      the 1v1 lobby (VersusLobby's app look, redrawn here)
//   /bucket?btlobby=matchup | leave | oppleft                 the 1v1 sheets
//   /bucket?btlobby=v1hud      the 1v1 bar over the build   (&open=1, &ready=1, &clock=15)
// To go from one to the next without a reload (screenshots): window.dispatchEvent(new CustomEvent('bap:btlobby', { detail: 'btlobby=full&size=2' }))
import { useEffect, useMemo, useState } from 'react'
import { BlacktopHubView, BlacktopQueue, BlacktopChat, OneOnOneOptions } from './AppBlacktop'
import { VersusSpot, OpenSpot, VersusBoard, VersusHud, VersusMatchup, VersusLeaveSheet, VersusOppLeftSheet } from './Blacktop1v1'
import OnlineRecord from './OnlineRecord'
import { IconClose } from './icons'
import { slotsFor } from '../../lib/blacktopCore'
import { makeMimics } from '../../lib/mimic'
import { VERSUS_GUARD_TYPES } from '../../data/nba-guards'
import { VERSUS_BIG_TYPES } from '../../data/nba-bigs'

const NO = () => {}
const ME = { vid: 'me', name: 'hoopsbygray', pos: 'guard' }
const PEOPLE = makeMimics(12, 7919)
const person = (i, extra = {}) => ({ vid: `p-${i}`, name: PEOPLE[i].name, cos: PEOPLE[i].cos, uid: null, ...extra })
const buildOf = (types, n, base) => Object.fromEntries(types.map((t, j) => [t, j < n ? { val: Math.max(1, Math.min(12, base + ((j * 5) % 4) - 1)) } : null]))

// a lobby that only lives on this page: tap a spot to take it, tap yours to leave it
function useFakeLobby({ size, open, full, bumped, link }) {
  const SLOTS = slotsFor(size)
  const [mine, setMine] = useState(open ? null : SLOTS[0].id)
  const [myPos, setMyPos] = useState('guard')
  const [chat, setChat] = useState(() => CHAT.slice(0, 3))
  const others = useMemo(() => {
    const out = {}
    SLOTS.forEach((sl, i) => {
      if (i === 0) return
      const take = full || (size === 3 ? [2, 3] : size === 2 ? [3] : []).includes(i)
      if (take) out[sl.id] = person(i, { pos: sl.pos === 'any' ? (i % 2 ? 'big' : 'guard') : sl.pos })
    })
    if (full && open) out[SLOTS[0].id] = person(0, { pos: SLOTS[0].pos === 'any' ? 'guard' : SLOTS[0].pos })
    return out
  }, [size, full, open]) // eslint-disable-line
  const held = { ...others, ...(mine && !others[mine] ? { [mine]: { ...ME, pos: SLOTS.find(s => s.id === mine)?.pos === 'any' ? myPos : SLOTS.find(s => s.id === mine)?.pos } } : {}) }
  return {
    slots: SLOTS, roomSize: SLOTS.length, size, held, me: ME, mySlot: mine && !others[mine] ? mine : null,
    seat: (id, pos) => { setMine(id); if (pos) setMyPos(pos) },
    queue: [{ vid: 'w1' }, { vid: 'w2' }], chat, seated: Object.keys(held).length, waited: 47, link: link || 'live', retry: NO,
    bumped: !!bumped, leave: NO, leaveLobby: NO, typers: [], typing: NO,
    sendChat: t => { if (!t.trim()) return false; setChat(c => [...c, { id: `m${c.length}`, from: 'me', name: ME.name, text: t.trim(), ts: Date.now() }]); return true },
  }
}

const T0 = Date.now() - 90000
const CHAT = [
  { id: 'a', from: 'p-2', name: PEOPLE[2].name, cos: PEOPLE[2].cos, text: 'need a big on blue', ts: T0 },
  { id: 'b', from: 'p-2', name: PEOPLE[2].name, cos: PEOPLE[2].cos, text: 'who got next', ts: T0 + 4000 },
  { id: 'c', from: 'me', name: ME.name, text: 'I got guard', ts: T0 + 9000 },
  { id: 'd', from: 'p-3', name: PEOPLE[3].name, cos: PEOPLE[3].cos, text: 'Let\'s go!', ts: T0 + 15000 },
  { id: 'e', from: 'p-4', name: PEOPLE[4].name, cos: PEOPLE[4].cos, text: 'run it back after this one, same squads if everybody stays', ts: T0 + 30000 },
  { id: 'f', from: 'me', name: ME.name, text: 'bet', ts: T0 + 34000 },
]

function Queue({ q, full }) {
  const size = Math.max(1, Math.min(3, Number(q.get('size')) || 3))
  const bt = useFakeLobby({ size, open: q.has('open'), full, bumped: q.has('bumped'), link: q.get('link') })
  return <BlacktopQueue bt={bt} user={null} onBack={NO} />
}

function Chat({ q, team }) {
  const [chat, setChat] = useState(() => (q.has('empty') ? [] : CHAT))
  const [shut, setShut] = useState(false)
  const players = [{ ...ME, team: 0, bot: false }, { ...person(1), team: 0, pos: 'guard', bot: false }, { vid: 'cpu', name: 'Hammer', team: 0, pos: 'big', bot: true }, { ...person(5), team: 1, pos: 'guard', bot: false }]
  const bt = {
    me: ME, chat, typers: q.has('empty') ? [] : [PEOPLE[3].name], typing: NO, myTeam: 0,
    sendChat: t => { if (!t.trim()) return false; setChat(c => [...c, { id: `m${c.length}`, from: 'me', name: ME.name, text: t.trim(), ts: Date.now() }]); return true },
    ...(team ? { match: { code: 'LOOK', players }, builds: { me: { build: buildOf(VERSUS_GUARD_TYPES, 6, 9), pos: 'guard' }, 'p-1': { build: buildOf(VERSUS_GUARD_TYPES, 8, 8), pos: 'guard' } } } : {}),
  }
  // (the rules gate reads localStorage: &rules=1 shows it without touching what's stored)
  const [had] = useState(() => { try { const v = localStorage.getItem('bap_chat_rules'); if (q.has('rules')) localStorage.removeItem('bap_chat_rules'); else localStorage.setItem('bap_chat_rules', '1'); return v } catch { return null } })
  void had
  return (
    <div className="ag-screen ag-screen--bucket btl-look">
      <div className="ag-screen-head"><div><span className="ag-eyebrow">DEV · LOOK</span><h1 className="ag-h1">{team ? 'Team chat' : 'Lobby chat'}</h1></div></div>
      <div className="ag-screen-body"><button className="ag-btn ag-btn--ghost" onClick={() => setShut(false)}>OPEN THE CHAT</button></div>
      {!shut && <BlacktopChat bt={bt} user={null} onClose={() => setShut(true)} {...(team ? {} : { title: 'LOBBY CHAT', mode: 'blacktop-lobby' })} />}
    </div>
  )
}

// VersusLobby's app look, redrawn on this page (the real one opens a channel as it mounts)
function V1({ look }) {
  const screen = look === 'v1menu' ? 'menu' : look === 'v1host' ? 'host' : 'searching'
  const found = look === 'v1found' ? person(6) : null
  const title = screen === 'host' ? 'Play a friend' : screen === 'searching' ? 'Pickup' : '1v1'
  return (
    <div className="ag-screen ag-screen--bucket v1 btl btl-lobby btl-look">
      <header className="btl-top">
        <div className="btl-top-txt"><span className="btl-eyebrow">BLACKTOP · 1V1 · FIRST TO 11</span><h1 className="btl-h1">{title}</h1></div>
        <button className="ag-round-btn btl-x" aria-label="Back to Blacktop"><IconClose size={16} /></button>
      </header>
      <div className="btl-body">
        {screen === 'menu' ? (
          <OneOnOneOptions onPickup={NO} onFriend={NO} onJoinCode={NO} error="" />
        ) : (
          <>
            <VersusBoard found={!!found} timer={screen === 'searching' ? '0:23' : null}
              code={screen === 'host' && !found ? 'K7QX2' : null} onCopy={NO}
              left={<VersusSpot who={{ name: ME.name, self: true }} team={0} sub="12W – 7L · 1V1" />}
              right={found
                ? <VersusSpot who={{ name: found.name, cos: found.cos }} team={1} sub="READY · 1V1" />
                : <OpenSpot title={screen === 'searching' ? 'SEARCHING…' : 'WAITING ON A FRIEND'} sub={screen === 'searching' ? 'PICKUP · 1V1' : 'FRIEND · 1V1'} />}
              hint={found ? 'Connected!' : screen === 'searching' ? 'Usually under a minute' : 'Waiting for your friend to join…'} />
            {!found && <button className="ag-btn btl-btn btl-btn--line">CANCEL</button>}
          </>
        )}
        <OnlineRecord modes={['h2hB']} title="1V1 RECORD" />
      </div>
    </div>
  )
}

function Sheets({ look, q }) {
  const [n, setN] = useState(0)
  const me = { name: ME.name, self: true, record: { wins: 12, losses: 7 } }
  const opp = { name: PEOPLE[6].name, cos: PEOPLE[6].cos, record: { wins: 31, losses: 18 } }
  const side = (who, pos, filled) => ({ ...who, pos, types: pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES, build: buildOf(pos === 'big' ? VERSUS_BIG_TYPES : VERSUS_GUARD_TYPES, filled, 8) })
  return (
    <div className="ag-screen ag-screen--bucket btl-look" key={n}>
      {look === 'v1hud' && <VersusHud clock={Number(q.get('clock')) || 134} me={side(me, 'guard', q.has('ready') ? 8 : 5)} opp={side(opp, 'big', q.has('ready') ? 8 : 3)} devOpen={q.has('open')} />}
      <div className="ag-screen-head"><div><span className="ag-eyebrow">DEV · LOOK</span><h1 className="ag-h1">{look}</h1></div></div>
      <div className="ag-screen-body"><button className="ag-btn ag-btn--ghost" onClick={() => setN(x => x + 1)}>PLAY IT AGAIN</button></div>
      {look === 'matchup' && <VersusMatchup me={me} opp={opp} oppPos={q.has('pos') ? 'big' : null} onPick={NO} />}
      {look === 'leave' && <VersusLeaveSheet opp={opp} onStay={NO} onLeave={NO} />}
      {look === 'oppleft' && <VersusOppLeftSheet opp={opp} me={me} onDone={NO} />}
    </div>
  )
}

const now = Date.now()
const LIVE = {
  1: [
    { code: 'L1A', size: 1, score: [7, 9], started: now - 252000, watchers: 3, players: [{ team: 0, name: PEOPLE[7].name, cos: PEOPLE[7].cos }, { team: 1, name: PEOPLE[8].name, cos: PEOPLE[8].cos }] },
  ],
  2: [],
  3: [
    { code: 'L3A', size: 3, score: [10, 8], started: now - 431000, watchers: 12, players: [0, 1, 2].map(i => ({ team: 0, name: PEOPLE[i].name, cos: PEOPLE[i].cos })).concat([3, 4].map(i => ({ team: 1, name: PEOPLE[i].name, cos: PEOPLE[i].cos })), [{ team: 1, cpu: true, name: 'Hammer' }]) },
    { code: 'L3B', size: 3, score: [4, 4], started: now - 118000, watchers: 0, players: [5, 6, 9].map(i => ({ team: 0, name: PEOPLE[i].name, cos: PEOPLE[i].cos })).concat([10, 11, 7].map(i => ({ team: 1, name: PEOPLE[i].name, cos: PEOPLE[i].cos }))) },
    { code: 'L3C', size: 3, score: [2, 6], started: now - 64000, watchers: 1, players: [8, 2, 4].map(i => ({ team: 0, name: PEOPLE[i].name, cos: PEOPLE[i].cos })).concat([1, 3, 0].map(i => ({ team: 1, name: PEOPLE[i].name, cos: PEOPLE[i].cos }))) },
    { code: 'L3D', size: 3, score: [0, 1], started: now - 20000, watchers: 0, players: [6, 7, 10].map(i => ({ team: 0, name: PEOPLE[i].name, cos: PEOPLE[i].cos })).concat([11, 9, 5].map(i => ({ team: 1, name: PEOPLE[i].name, cos: PEOPLE[i].cos }))) },
  ],
}

export default function BlacktopLobbyLook({ look: first }) {
  // the look asked for in the address, or the one asked for since (bap:btlobby)
  const [qs, setQs] = useState(window.location.search)
  useEffect(() => {
    const on = e => setQs(`?${e.detail}`)
    window.addEventListener('bap:btlobby', on)
    return () => window.removeEventListener('bap:btlobby', on)
  }, [])
  const q = new URLSearchParams(qs)
  return <Look key={qs} look={q.get('btlobby') || first} q={q} />
}
function Look({ look, q }) {
  const [notice, setNotice] = useState(q.has('empty') ? null : 'The build clock ran out before you finished. A CPU took your spot, and it counts as leaving the game.')
  if (look === 'queue' || look === 'full') return <div className="btl-look"><Queue q={q} full={look === 'full'} /></div>
  if (look === 'chat' || look === 'teamchat') return <Chat q={q} team={look === 'teamchat'} />
  if (look.startsWith('v1') && look !== 'v1hud') return <V1 look={look} />
  if (['matchup', 'leave', 'oppleft', 'v1hud'].includes(look)) return <Sheets look={look} q={q} />
  const quiet = q.has('empty')
  return (
    <div className="btl-look">
      <BlacktopHubView onBack={NO} onJoin3v3={NO} onJoin2v2={NO} onJoin1v1={NO} onPractice={NO} onPickup={NO} onFriend={NO} onJoinCode={NO}
        onWatch={NO} notice={notice} onNotice={() => setNotice(null)}
        rating={1184} live={quiet ? { 1: [], 2: [], 3: [] } : LIVE} onCourt={quiet ? 0 : 38} waiting={quiet ? null : { 'bt:3': 4, 'bt:1': 1 }} />
    </div>
  )
}
