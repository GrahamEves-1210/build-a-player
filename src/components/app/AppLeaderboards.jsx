import { useEffect, useMemo, useState } from 'react'
import { SkRows } from './Skeleton'
import { motion } from 'motion/react'
import { useProgress, tierFor, nextTier, dayKey, dayIndex, weekEnds } from '../../lib/progress'
import { onlineBoards, todayBoards, recordBoards, blacktopModes, positionsFor, positionLabel, boardSports, hasGrid, loadBoard, peekBoard, lastWeekChampion } from '../../lib/boards'
import { loadFriends, useFriendsOnly } from '../../lib/friends'
import { getUsername } from '../../lib/discord'
import { rampAdd } from '../../lib/ads'
import { sfx } from '../../lib/juice'
import { SPRING_LAYOUT } from '../../lib/motion'
import { NameTag, AvatarBadge } from './NameTag'
import { IconArrow, IconCoin } from './icons'
import EmptyState from './EmptyState'

// Ranks (the dock's tab). Three questions, one tab each: where do I stand online,
// who's winning today, and who holds the records. Every board is the same list; the
// player's own standing sits above it. Data: lib/boards.js.

const nav = to => window.dispatchEvent(new CustomEvent('bap:nav', { detail: to }))
const TABS = [['online', 'ONLINE'], ['today', 'TODAY'], ['records', 'RECORDS']]
const TIER_COLOR = { Rookie: '#9aa7a0', Starter: '#5EDBD8', Pro: '#60a5fa', 'All-Star': '#a78bfa', MVP: '#fb923c', Legend: '#f5dc8a' }
// what gets a player onto a board they aren't on yet
// the Cup's days left, today counted: it ends with Sunday
const cupLeft = () => { const n = dayIndex(weekEnds()) - dayIndex(dayKey()) + 1; return n <= 1 ? 'LAST DAY' : `${n} DAYS LEFT` }
const PLAY = { rating: ['PLAY ONLINE', 'online'], played: ['PLAY ONLINE', 'online'], bt: ['PLAY ONLINE', 'online'], bt1: ['PLAY ONLINE', 'online'], bt2: ['PLAY ONLINE', 'online'], bt3: ['PLAY ONLINE', 'online'], daily: ['PLAY DAILY PUZZLE', 'daily'], cup: ['PLAY DAILY PUZZLE', 'daily'], grid: ['PLAY DAILY GRID', 'salarycap'] }
// Football and Basketball, and Soccer once it's live (SOCCER_LIVE): the records' sports. The Daily Grid's are the ones with one
const SPORTS = boardSports()
const GRID_SPORTS = SPORTS.filter(s => hasGrid(s.id))
// (a small gap keeps its decimals: an ERA or an OPS apart by .02; a board where low is best, ERA, counts it the other way)
const gapText = x => { const a = Math.abs(x); return a.toLocaleString(undefined, { maximumFractionDigits: a > 0 && a < 0.1 ? 3 : a > 0 && a < 1 ? 2 : 1 }) }
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

// Go play it. The Daily Grid belongs to a sport: the other sport's is a page load away
function goPlay(to, sport, boardSport) {
  const here = sport === 'bucket' || sport === 'soccer' || sport === 'baseball' ? sport : 'nfl'
  if (to === 'salarycap' && boardSport !== here) window.location.href = boardSport === 'bucket' ? '/bucket/salary' : boardSport === 'soccer' ? '/soccer/salary' : '/salary'
  else nav(to)
}

// The player's own line: the one thing on the page that's about them
function Standing({ boardId, board, unit, p, sport, boardSport }) {
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
        <button className="ag-btn lbd-me-go" onClick={() => goPlay(play[1], sport, boardSport)}>{play[0]} <IconArrow size={16} /></button>
      </section>
    )
  }
  // the next thing to chase: the next tier online, the player ahead everywhere else
  const ahead = mine.rank > 1 ? board.rows[mine.rank - 2] : null
  const tier = boardId === 'rating' ? tierFor(mine.value)[1] : null
  const next = boardId === 'rating' ? nextTier(mine.value) : null
  const chase = mine.rank === 1 ? 'FIRST PLACE'
    : next ? `${gapText(next[0] - mine.value)} TO ${next[1].toUpperCase()}`
    : ahead ? `${gapText(ahead.value - mine.value)} BEHIND ${(ahead.name || 'Player').toUpperCase()}`
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

function Row({ r, i, me, style, tierSub, prizes }) {
  return (
    <div className={`lbd-row lbd-row--${Math.min(i + 1, 4)}${r.uid && r.uid === me ? ' is-me' : ''}`} style={style}>
      <span className="lbd-rank">{i + 1}</span>
      <AvatarBadge name={r.name} uid={r.uid} size={32} className="lbd-av" />
      <span className="lbd-name">
        <NameTag name={r.name || 'Player'} uid={r.uid} />
        {r.pro && <span className="lb-plus-badge" title="BAP Pro">PRO</span>}
      </span>
      {prizes
        ? <>
            {r.coins ? <span className="lbd-coins"><IconCoin size={14} />{r.coins.toLocaleString()}</span> : <span />}
            <span className="lbd-stack"><span className="lbd-val">{r.display}</span>{r.sub && <small>{r.sub}</small>}</span>
          </>
        : <>
            <span className="lbd-sub-val" style={tierSub ? { color: TIER_COLOR[r.sub] } : undefined}>{r.sub ? (tierSub ? r.sub.toUpperCase() : r.sub) : ''}</span>
            <span className="lbd-val">{r.display}</span>
          </>}
    </div>
  )
}

// A board: a list with one ad slot that never remounts (it stays put in the DOM; rows take
// their places around it with `order`), so switching boards doesn't throw the ad away
function BoardList({ boardId, board, unit, me, friends }) {
  if (board == null) return <SkRows n={10} label="Loading the board" />
  if (board.error) return <div className="ag-board-empty">This board isn't available right now.</div>
  if (!board.rows.length) return (
    <EmptyState kind="podium" title={friends ? 'No friends here yet' : 'Nobody here yet'}>{friends ? 'Add friends from any name on a board.' : 'The first score takes #1.'}</EmptyState>
  )
  return (
    <>
      <div className="lbd-head" style={{ order: -1 }}><span>PLAYER</span><span>{unit}</span></div>
      {board.rows.map((r, i) => <Row key={r.uid ?? `${r.name}-${i}`} r={r} i={i} me={me} tierSub={boardId === 'rating' || boardId === 'played'} prizes={boardId === 'potd' || boardId === 'cup'} style={{ order: i < AD_AFTER ? i : i + 2 }} />)}
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

  // Records and the Daily Grid belong to a sport: starts on the one being played, either can be read
  const [boardSport, setBoardSport] = useState(SPORTS.some(s => s.id === sport) ? sport : 'nfl')
  const positions = useMemo(() => positionsFor(boardSport), [boardSport])
  const [footballPos, setPosition] = useState(() => {
    const all = positionsFor('nfl')
    let last = ''
    try { last = (localStorage.getItem('lastPosition') || '').toUpperCase() } catch {}
    return all.includes(last) ? last : all[0]
  })
  // (baseball: batter or pitcher, its own pick; it starts on the one being played)
  const [baseballPos, setBaseballPos] = useState(() => { try { return localStorage.getItem('baseballPosition') === 'pit' ? 'pit' : 'bat' } catch { return 'bat' } })
  const position = boardSport === 'bucket' ? null : boardSport === 'baseball' ? baseballPos : footballPos
  const [pick, setPick] = useState({ online: 'rating', today: 'daily' })
  const [btMode, setBtMode] = useState('bt')
  const [open, setOpen] = useState(null)   // a record's full board

  const boards = tab === 'online' ? onlineBoards(sport) : tab === 'today' ? todayBoards(sport) : null
  // (the Cup is a cached top 50 that a friend is rarely on: it can't be narrowed to friends)
  // (baseball with no Grid of its own has no Grid tab: it never shows another sport's)
  const shown = boards ? boards.filter(b => !(friendsOn && b.id === 'cup') && !(b.id === 'grid' && boardSport === 'baseball' && !hasGrid('baseball'))) : boards
  const picked = tab === 'records' ? open : shown.find(b => b.id === pick[tab]) ?? shown[0]
  // (soccer has no Daily Grid: on the grid it reads football's)
  const onGrid = picked?.id === 'grid'
  const dataSport = onGrid && !hasGrid(boardSport) ? 'nfl' : boardSport
  const opts = { sport: dataSport, position, uid, friendIds: friendsOn ? friendIds ?? [] : undefined }
  const isBlacktop = picked?.id === 'bt'
  const current = isBlacktop ? { ...picked, id: btMode } : picked
  const board = useBoard(current?.id, opts)

  const records = useMemo(() => recordBoards(boardSport, position), [boardSport, position])
  const groups = useMemo(() => [...new Set(records.map(r => r.group))], [records])

  const [champ, setChamp] = useState(null)
  useEffect(() => { if (tab === 'today' && current?.id === 'cup') lastWeekChampion().then(setChamp, () => {}) }, [tab, current?.id])

  // the mobile in-feed ad: one slot, asked for once
  useEffect(() => {
    if (adsDisabled || window.innerWidth > 768) return
    rampAdd([{ type: 'standard_iab_cntr1', selectorId: AD_ID }])
  }, [adsDisabled])

  const overview = tab === 'records' && !open
  const pickTab = id => { setTab(id); setOpen(null); sfx('tap'); document.querySelector('.lbd-screen')?.scrollTo({ top: 0 }) }

  return (
    <div className="ag-screen lbd-screen">
      <div className="lbd-wrap">
        <header className="lbd-top">
          <h1 className="ag-h1">Ranks</h1>
          {!!uid && (
            <div className="lbd-scope" role="group" aria-label="Whose scores">
              <button className={friendsOn ? '' : 'is-on'} aria-pressed={!friendsOn} onClick={() => setFriendsPick(false)}>EVERYONE</button>
              <button className={friendsOn ? 'is-on' : ''} aria-pressed={friendsOn} onClick={() => setFriendsPick(true)}>FRIENDS</button>
            </div>
          )}
        </header>

        <div className="ag-seg lbd-tabs" role="tablist" aria-label="Ranks">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => pickTab(id)}>
              {tab === id && <motion.span layoutId="lbd-tab" className="ag-seg-pill" transition={SPRING_LAYOUT} />}
              {label}
            </button>
          ))}
        </div>

        {boards && <SubTabs items={shown} value={picked.id} onPick={id => setPick(s => ({ ...s, [tab]: id }))} label="Boards" />}
        {isBlacktop && <SubTabs items={blacktopModes()} value={btMode} onPick={setBtMode} label="Game size" />}
        {(overview || current?.id === 'grid') && <SubTabs items={onGrid ? GRID_SPORTS : SPORTS} value={dataSport} onPick={id => { setBoardSport(id); setOpen(null) }} label="Sport" />}
        {overview && positions.length > 0 && (/* (baseball's Grid is batters only: no picker there) */
          <SubTabs items={positions.map(x => ({ id: x, label: positionLabel(boardSport, x) }))} value={position} onPick={boardSport === 'baseball' ? setBaseballPos : setPosition} label="Position" />
        )}
        {open && (
          <button className="lbd-back" onClick={() => { setOpen(null); sfx('tap') }}><IconArrow size={16} style={{ transform: 'rotate(180deg)' }} /> RECORDS</button>
        )}
        {open && <h2 className="lbd-title">{open.label}<i>{(boardSport === 'soccer' ? ['SOCCER', open.group] : boardSport === 'baseball' ? [positionLabel('baseball', position), open.group] : [open.group === 'MODES' ? null : position ?? 'BASKETBALL', open.group === 'ALL-TIME' ? 'ALL-TIME' : null]).filter(Boolean).join(' · ')}</i>{open.note && <em>{open.note}</em>}</h2>}

        {tab === 'today' && current?.id === 'cup' && <div className="lbd-left">{cupLeft()}</div>}
        {current && <Standing boardId={current.id} board={board} unit={current.unit} p={p} sport={sport} boardSport={dataSport} />}
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
