import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useProgress, tierFor, nextTier } from '../../lib/progress'
import { onlineBoards, todayBoards, recordBoards, positionsFor, loadBoard, peekBoard, lastWeekChampion } from '../../lib/boards'
import { loadFriends, useFriendsOnly } from '../../lib/friends'
import { getUsername } from '../../lib/discord'
import { rampAdd } from '../../lib/ads'
import { sfx } from '../../lib/juice'
import { SPRING_LAYOUT } from '../../lib/motion'
import { NameTag, AvatarBadge } from './NameTag'
import { IconArrow } from './icons'
import EmptyState, { PassLoader } from './EmptyState'

// Leaderboards (dock → Ranks). Three questions, one tab each: where do I stand online,
// who's winning today, and who holds the records. Every board is the same list; the
// player's own standing sits above it. Data: lib/boards.js.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
const TABS = [['online', 'ONLINE'], ['today', 'TODAY'], ['records', 'RECORDS']]
const TIER_COLOR = { Rookie: '#9aa7a0', Starter: '#5EDBD8', Pro: '#60a5fa', 'All-Star': '#a78bfa', MVP: '#fb923c', Legend: '#f5dc8a' }
// what gets a player onto a board they aren't on yet
const PLAY = { rating: ['PLAY ONLINE', 'online'], peak: ['PLAY ONLINE', 'online'], played: ['PLAY ONLINE', 'online'], daily: ['PLAY DAILY PUZZLE', 'daily'], cup: ['PLAY DAILY PUZZLE', 'daily'] }
const AD_AFTER = 10
const AD_ID = 'ramp-cntr1-lbd-mob-1'

// kept for the visit, so going back to a tab picks up where it was
let friendIdsOf = { uid: null, ids: null }

function useBoard(id, opts) {
  const key = `${id}|${opts.sport}|${opts.position ?? ''}|${opts.uid ?? ''}|${opts.friendIds ? opts.friendIds.join() : ''}`
  const [res, setRes] = useState(() => (id ? peekBoard(id, opts) : null))
  useEffect(() => {
    if (!id) return
    let live = true
    setRes(peekBoard(id, opts))
    loadBoard(id, opts).then(r => { if (live) setRes(r) })
    return () => { live = false }
  }, [key])
  return res
}

function SubTabs({ items, value, onPick, label }) {
  return (
    <div className="lbd-sub" role="tablist" aria-label={label}>
      {items.map(b => (
        <button key={b.id} role="tab" aria-selected={b.id === value} className={b.id === value ? 'is-on' : ''} onClick={() => { onPick(b.id); sfx('tap') }}>{b.label}</button>
      ))}
    </div>
  )
}

// The player's own line: the one thing on the page that's about them
function Standing({ boardId, board, unit, p }) {
  const name = p.signedIn ? getUsername(p.user) || 'Player' : 'Guest'
  const play = PLAY[boardId]
  if (!board || board.error) return null
  const mine = board.mine
  if (!p.signedIn) return (
    <section className="lbd-me lbd-me--out">
      <span className="lbd-me-who"><AvatarBadge name={name} size={40} /><span className="lbd-me-name">{name}</span></span>
      <button className="ag-btn lbd-me-go" onClick={() => nav('profile')}>SIGN IN TO RANK</button>
    </section>
  )
  if (!mine) {
    if (!play) return null
    return (
      <section className="lbd-me lbd-me--out">
        <span className="lbd-me-who"><AvatarBadge self name={name} size={40} /><NameTag name={name} self /></span>
        <button className="ag-btn lbd-me-go" onClick={() => nav(play[1])}>{play[0]} <IconArrow size={16} /></button>
      </section>
    )
  }
  // the next thing to chase: the next tier online, the player ahead everywhere else
  const ahead = mine.rank > 1 ? board.rows[mine.rank - 2] : null
  const tier = boardId === 'rating' ? tierFor(mine.value)[1] : null
  const next = boardId === 'rating' ? nextTier(mine.value) : null
  const chase = mine.rank === 1 ? 'FIRST PLACE'
    : next ? `${(next[0] - mine.value).toLocaleString()} TO ${next[1].toUpperCase()}`
    : ahead ? `${(ahead.value - mine.value).toLocaleString()} BEHIND ${(ahead.name || 'Player').toUpperCase()}`
    : null
  return (
    <section className="lbd-me">
      <span className="lbd-me-rank"><i>#</i>{mine.rank.toLocaleString()}</span>
      <span className="lbd-me-mid">
        <span className="lbd-me-who"><AvatarBadge self name={name} size={26} /><NameTag name={name} self /></span>
        {chase && <span className="lbd-me-chase">{tier && <b style={{ color: TIER_COLOR[tier] }}>{tier.toUpperCase()}</b>}{tier && ' · '}{chase}</span>}
      </span>
      <span className="lbd-me-val">{mine.display}<i>{unit}</i></span>
    </section>
  )
}

function Row({ r, i, me, style, tierSub }) {
  return (
    <div className={`lbd-row lbd-row--${Math.min(i + 1, 4)}${r.uid && r.uid === me ? ' is-me' : ''}`} style={style}>
      <span className="lbd-rank">{i + 1}</span>
      <span className="lbd-name">
        <AvatarBadge name={r.name} uid={r.uid} size={i === 0 ? 36 : i < 3 ? 30 : 26} />
        <NameTag name={r.name || 'Player'} uid={r.uid} />
        {r.pro && <span className="lb-plus-badge" title="BAP Pro">PRO</span>}
      </span>
      {r.sub && <span className="lbd-sub-val" style={tierSub ? { color: TIER_COLOR[r.sub] } : undefined}>{tierSub ? r.sub.toUpperCase() : r.sub}</span>}
      <span className="lbd-val">{r.display}</span>
    </div>
  )
}

// A board: a list with one ad slot that never remounts (it stays put in the DOM; rows take
// their places around it with `order`), so switching boards doesn't throw the ad away
function BoardList({ boardId, board, unit, me, friends }) {
  if (board == null) return <PassLoader />
  if (board.error) return <div className="ag-board-empty">This board isn't available right now.</div>
  if (!board.rows.length) return (
    <EmptyState kind="podium" title={friends ? 'No friends here yet' : 'Nobody here yet'}>{friends ? 'Add friends from any name on a board.' : 'The first score takes #1.'}</EmptyState>
  )
  return (
    <>
      <div className="lbd-head" style={{ order: -1 }}><span>PLAYER</span><span>{unit}</span></div>
      {board.rows.map((r, i) => <Row key={r.uid ?? `${r.name}-${i}`} r={r} i={i} me={me} tierSub={boardId === 'rating' || boardId === 'peak'} style={{ order: i < AD_AFTER ? i : i + 2 }} />)}
    </>
  )
}

// One record: its holder and the number. Opens the full board.
function RecordRow({ b, opts, onOpen, style }) {
  const board = useBoard(b.id, opts)
  const top = board?.rows?.[0]
  return (
    <button className="lbd-rec" style={style} onClick={() => { onOpen(b); sfx('tap') }} disabled={board?.error}>
      <span className="lbd-rec-label">{b.label}</span>
      <span className="lbd-rec-holder">
        {board == null ? <span className="lbd-rec-wait" />
          : top ? <><AvatarBadge name={top.name} uid={top.uid} size={22} /><NameTag name={top.name || 'Player'} uid={top.uid} link={false} />{top.pro && <span className="lb-plus-badge" title="BAP Pro">PRO</span>}</>
          : <span className="lbd-rec-none">{board.error ? 'Unavailable' : 'Open'}</span>}
      </span>
      <span className="lbd-rec-val">{top ? top.display : ''}<i>{top ? b.unit : ''}</i></span>
    </button>
  )
}

export default function AppLeaderboards({ sport, adsDisabled = false }) {
  const p = useProgress()
  const uid = p.user?.id ?? null
  const [tab, setTab] = useState('online')
  const [friendsPick, setFriendsPick] = useFriendsOnly()
  const friendsOn = friendsPick && !!uid   // (signing out with Friends on must not leave empty boards)
  const [friendIds, setFriendIds] = useState(() => (friendIdsOf.uid === uid ? friendIdsOf.ids : null))

  useEffect(() => {
    if (!friendsOn || (friendIdsOf.uid === uid && friendIdsOf.ids)) return
    let live = true
    loadFriends(uid).then(r => {
      const ids = (r.friends ?? []).map(f => f.id)
      friendIdsOf = { uid, ids }
      if (live) setFriendIds(ids)
    }, () => {})
    return () => { live = false }
  }, [friendsOn, uid])

  const positions = useMemo(() => positionsFor(sport), [sport])
  const [position, setPosition] = useState(() => {
    let last = ''
    try { last = (localStorage.getItem('lastPosition') || '').toUpperCase() } catch {}
    return positions.includes(last) ? last : positions[0] ?? null
  })
  const [pick, setPick] = useState({ online: 'rating', today: 'daily' })
  const [open, setOpen] = useState(null)   // a record's full board

  const opts = { sport, position, uid, friendIds: friendsOn ? friendIds ?? [] : undefined }
  const boards = tab === 'online' ? onlineBoards(sport) : tab === 'today' ? todayBoards(sport) : null
  // boards that can't be narrowed to friends: 1v1 has no account ids, Players of the Day and the
  // Cup are cached top lists that a friend is rarely on
  const shown = friendsOn && boards ? boards.filter(b => !['h2h', 'potd', 'cup'].includes(b.id)) : boards
  const current = tab === 'records' ? open : shown.find(b => b.id === pick[tab]) ?? shown[0]
  const board = useBoard(current?.id, opts)

  const records = useMemo(() => recordBoards(sport, position), [sport, position])
  const groups = useMemo(() => [...new Set(records.map(r => r.group))], [records])

  const [champ, setChamp] = useState(null)
  useEffect(() => { if (tab === 'today' && current?.id === 'cup') lastWeekChampion().then(setChamp, () => {}) }, [tab, current?.id])

  // the mobile in-feed ad: one slot, asked for once
  useEffect(() => {
    if (adsDisabled || window.innerWidth > 768) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: AD_ID }])
  }, [adsDisabled])

  const pickTab = id => { setTab(id); setOpen(null); sfx('tap'); document.querySelector('.lbd-screen')?.scrollTo({ top: 0 }) }
  const overview = tab === 'records' && !open

  return (
    <div className="ag-screen lbd-screen">
      <div className="lbd-wrap">
        <header className="lbd-top">
          <h1 className="ag-h1">Leaderboards</h1>
          {!!uid && (
            <div className="lbd-scope" role="group" aria-label="Whose scores">
              <button className={friendsOn ? '' : 'is-on'} aria-pressed={!friendsOn} onClick={() => setFriendsPick(false)}>EVERYONE</button>
              <button className={friendsOn ? 'is-on' : ''} aria-pressed={friendsOn} onClick={() => setFriendsPick(true)}>FRIENDS</button>
            </div>
          )}
        </header>

        <div className="ag-seg lbd-tabs" role="tablist" aria-label="Leaderboards">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => pickTab(id)}>
              {tab === id && <motion.span layoutId="lbd-tab" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
              {label}
            </button>
          ))}
        </div>

        {boards && <SubTabs items={shown} value={current.id} onPick={id => setPick(s => ({ ...s, [tab]: id }))} label="Boards" />}
        {tab === 'records' && !open && positions.length > 0 && (
          <SubTabs items={positions.map(x => ({ id: x, label: x }))} value={position} onPick={setPosition} label="Position" />
        )}
        {open && (
          <button className="lbd-back" onClick={() => { setOpen(null); sfx('tap') }}><IconArrow size={16} style={{ transform: 'rotate(180deg)' }} /> RECORDS</button>
        )}
        {open && <h2 className="lbd-title">{open.label}{open.group === 'SEASONS' && position ? <i>{position}</i> : null}</h2>}

        {current && <Standing boardId={current.id} board={board} unit={current.unit} p={p} />}
        {tab === 'today' && current?.id === 'cup' && champ && (
          <div className="lbd-champ"><span>LAST WEEK'S CHAMPION</span><b><NameTag name={champ.name} uid={champ.uid} /></b><em>{champ.display}</em></div>
        )}

        <div className="lbd-list">
          {overview
            ? groups.flatMap((g, gi) => [
                <div key={g} className="lbd-group" style={{ order: gi * 40 }}>{g}</div>,
                ...records.filter(r => r.group === g).map((r, i) => <RecordRow key={`${r.id}${position}`} b={r} opts={opts} onOpen={setOpen} style={{ order: gi * 40 + i + 1 }} />),
              ])
            : <BoardList boardId={current.id} board={board} unit={current.unit} me={uid} friends={friendsOn} />}
          {!adsDisabled && <div id={AD_ID} className="ad-cntr1-mobile lb-list-ad" style={{ order: overview ? 1000 : AD_AFTER }} />}
        </div>
      </div>
    </div>
  )
}
