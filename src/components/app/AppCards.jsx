import { useEffect, useMemo, useState } from 'react'
import { XpIco } from './GainIcons'
import { useProgress, cardKey, rarityRank, RARITIES, claimSet, setReward } from '../../lib/progress'
import { HEADSHOT_BASE, nflHeadshot } from '../../utils/simulation'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconCheck, IconGift, IconCrown, IconStar, IconArrow, IconFootball, IconBasketball } from './icons'
import EmptyState, { PassLoader } from './EmptyState'

// Card binder (dock → Cards). Every player a spin lands on is collected, across
// every position, both eras and both sports, into one collection. Sets are the
// ways to complete it: a franchise (every player who ever wore the jersey),
// a position, every Legend, a decade of legends. Sets stay per sport (their ids
// carry the sport, so claimed sets stay claimed) and each set kind lists the
// football sets, then the basketball sets. Both rosters load in parallel.

const NFL_POS = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB' }
const NBA_POS = { guard: 'GUARD', big: 'BIG' }

async function loadNfl() {
  const [qbs, rbs, wrs, tes, dbs, ql, rl, wl, tl, dl, teams, hs] = await Promise.all([
    import('../../data/qbs'), import('../../data/rbs'), import('../../data/wrs'), import('../../data/tes'), import('../../data/dbs'),
    import('../../data/qb-legends'), import('../../data/rb-legends'), import('../../data/wr-legends'), import('../../data/te-legends'), import('../../data/db-legends'),
    import('../../data/nfl-teams'), import('../../data/headshots.json'),
  ])
  return {
    pools: {
      qb: { classic: qbs.QBS, 'all-time': ql.LEGENDS },
      rb: { classic: rbs.RBS, 'all-time': rl.RB_LEGENDS },
      wr: { classic: wrs.WRS, 'all-time': wl.WR_LEGENDS },
      te: { classic: tes.TES, 'all-time': tl.TE_LEGENDS },
      db: { classic: dbs.DBS, 'all-time': dl.DB_LEGENDS },
    },
    posLabel: NFL_POS,
    teams: teams.TEAMS,
    logo: t => `/logos/${t}.png`,
    photo: name => nflHeadshot(hs.default[name]),
  }
}
async function loadNba() {
  const [g, b, ag, ab, teams, hs] = await Promise.all([
    import('../../data/nba-guards'), import('../../data/nba-bigs'), import('../../data/nba-guard-legends'), import('../../data/nba-big-legends'),
    import('../../data/nba-teams'), import('../../data/nba-headshots.json'),
  ])
  return {
    pools: {
      guard: { classic: g.NBA_GUARD_PLAYERS, 'all-time': ag.NBA_ALLTIME_GUARD_PLAYERS },
      big:   { classic: b.NBA_BIG_PLAYERS,  'all-time': ab.NBA_ALLTIME_BIG_PLAYERS },
    },
    posLabel: NBA_POS,
    teams: teams.NBA_TEAMS,
    logo: t => `/logos/nba/${t}.png`,
    photo: name => { const id = hs.default[name]; return id ? `${HEADSHOT_BASE}/nba/${id}.webp` : null },
  }
}
const cache = {}
const loadSport = s => (cache[s] ??= (s === 'bucket' ? loadNba() : loadNfl()))
const SPORTS = [
  { id: 'nfl',    label: 'FOOTBALL',   Icon: IconFootball },
  { id: 'bucket', label: 'BASKETBALL', Icon: IconBasketball },
]
const loadAll = () => Promise.all(SPORTS.map(s => loadSport(s.id))).then(list => Object.fromEntries(SPORTS.map((s, i) => [s.id, list[i]])))

const generic = skin => {
  if (!skin) return '/genericdark.webp'
  const r = parseInt(skin.slice(1, 3), 16), g = parseInt(skin.slice(3, 5), 16), b = parseInt(skin.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '/genericlight.webp' : '/genericdark.webp'
}
const lastName = n => { const parts = n.split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : n }
const decadeOf = years => { const m = /^(\d{4})/.exec(years || ''); if (!m) return null; const d = Math.floor(+m[1] / 10) * 10; return d < 1960 ? 1900 : d }

// Every card in a sport, with its owner state
function allCards(data, sport, owned) {
  const out = []
  for (const [pos, modes] of Object.entries(data.pools)) {
    for (const [mode, pool] of Object.entries(modes)) {
      for (const player of pool) {
        const key = cardKey(sport, pos, mode, player.name, player.team)
        const o = owned[key]
        out.push({ key, sport, player, pos, mode, team: player.team, rank: rarityRank(pool, player), owned: !!o, count: o?.[0] ?? 0, seen: o?.[1] ?? 0 })
      }
    }
  }
  return out
}

const KINDS = [
  { id: 'team',    label: 'TEAMS' },
  { id: 'pos',     label: 'POSITIONS' },
  { id: 'legends', label: 'LEGENDS' },
  { id: 'decade',  label: 'DECADES' },
]

// The sets a collection can be completed by
function buildSets(cards, data, sport) {
  const sets = []
  const push = (id, kind, title, sub, list, extra = {}) => { if (list.length) sets.push({ id: `${sport}|${id}`, sport, kind, title, sub, cards: list, owned: list.filter(c => c.owned).length, total: list.length, ...extra }) }
  // franchises — every player who wore the jersey, any position, any era
  const byTeam = new Map()
  for (const c of cards) { if (!byTeam.has(c.team)) byTeam.set(c.team, []); byTeam.get(c.team).push(c) }
  for (const [short, list] of [...byTeam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const meta = data.teams.find(t => t.short === short) ?? { short, name: short, color: list[0]?.player.color }
    push(`team|${short}`, 'team', meta.name, `${list.length} players`, list, { short, color: meta.color, logo: data.logo(short) })
  }
  // positions, by era
  for (const pos of Object.keys(data.pools)) {
    for (const mode of ['classic', 'all-time']) {
      const list = cards.filter(c => c.pos === pos && c.mode === mode)
      push(`pos|${pos}|${mode}`, 'pos', `${mode === 'all-time' ? 'ALL-TIME ' : ''}${data.posLabel[pos]}S`, mode === 'all-time' ? 'Every legend at the position' : 'Every current player at the position', list, { gold: mode === 'all-time' })
    }
  }
  // the rarest cards
  push('legends', 'legends', 'LEGEND CARDS', 'Every Legend-rarity card in the game', cards.filter(c => c.rank === 3), { gold: true })
  push('epics', 'legends', 'EPIC CARDS', 'Every Epic-rarity card in the game', cards.filter(c => c.rank === 2), { purple: true })
  // decades — legends by the year they broke in
  const byDecade = new Map()
  for (const c of cards) { const d = decadeOf(c.player.years); if (d) { if (!byDecade.has(d)) byDecade.set(d, []); byDecade.get(d).push(c) } }
  for (const [d, list] of [...byDecade.entries()].sort((a, b) => a[0] - b[0])) {
    if (d === 1900) push('decade|pioneers', 'decade', 'THE PIONEERS', 'Legends who broke in before 1960', list, { gold: true })
    else push(`decade|${d}`, 'decade', `THE ${String(d).slice(2)}s`, `Legends who broke in between ${d} and ${d + 9}`, list, { gold: true })
  }
  return sets
}

function Card({ c, data, color, i, small = false, mark = false }) {
  const { player, rank, owned, count, pos, mode } = c
  const photo = data.photo(player.name) ?? generic(player.skin)
  return (
    <div className={`ag-ct ag-rar-${rank}${owned ? '' : ' is-locked'}`} style={{ '--tc': player.color || color, '--d': `${Math.min(i, 30) * 22}ms` }}>
      <div className="ag-ct-photo">
        <img src={photo} alt="" loading="lazy" draggable={false} onError={e => { e.currentTarget.src = generic(player.skin) }} />
        {!owned && <span className="ag-ct-q">?</span>}
      </div>
      <div className="ag-ct-foot">
        <span className="ag-ct-name">{lastName(player.name)}</span>
        <span className="ag-ct-rar">{RARITIES[rank]}</span>
      </div>
      {!small && <span className={`ag-ct-tag${mode === 'all-time' ? ' ag-ct-tag--at' : ''}`}>{mode === 'all-time' ? <IconStar size={10} className="ag-ct-star" /> : null}{data.posLabel[pos]}</span>}
      {owned && count > 1 && <span className="ag-ct-count">×{count}</span>}
      {mark && <SportMark sport={c.sport} className="ag-ct-sport" />}
    </div>
  )
}

function SportMark({ sport, className, size = 12 }) {
  const S = SPORTS.find(x => x.id === sport) ?? SPORTS[0]
  return <span className={className} role="img" aria-label={S.label.toLowerCase()}><S.Icon size={size} /></span>
}

function SetTile({ s, onOpen, i }) {
  const done = s.owned === s.total
  const cls = `ag-set${s.kind === 'team' ? '' : ' ag-set--text'}${done ? ' is-complete' : ''}${s.owned === 0 ? ' is-empty' : ''}${s.gold ? ' ag-set--gold' : ''}${s.purple ? ' ag-set--purple' : ''}`
  return (
    <button className={cls} style={{ '--tc': s.color ?? (s.gold ? '#D4AF37' : s.purple ? '#a855f7' : '#5EDBD8'), '--d': `${Math.min(i, 16) * 18}ms` }} onClick={onOpen}>
      {s.kind === 'team'
        ? <><img src={s.logo} alt="" className="ag-set-tile-logo" loading="lazy" /><span className="ag-set-tile-short">{s.short}</span></>
        : <><span className="ag-set-kind-title">{s.title}</span><span className="ag-set-kind-sub">{s.sub}</span></>}
      <span className="ag-set-tile-bar"><span style={{ width: `${(s.owned / s.total) * 100}%` }} /></span>
      <span className="ag-set-tile-n">{s.owned}/{s.total}{s.kind !== 'team' && !done ? ` · ${setReward(s.total)} XP` : ''}</span>
      {done && (s.claimed ? <span className="ag-set-tick"><IconCheck size={12} /></span> : <span className="ag-set-gift"><IconGift size={14} /></span>)}
    </button>
  )
}

export default function AppCards({ sport: startSport, onClose, hall = null }) {
  const p = useProgress()
  const saved = (() => { try { return JSON.parse(localStorage.getItem('ag_cards_view')) || {} } catch { return {} } })()
  const [kind, setKind] = useState(KINDS.some(k => k.id === saved.kind) ? saved.kind : 'team')
  const [data, setData] = useState(null)        // { nfl, bucket }
  const [open, setOpen] = useState(null)        // set id

  useEffect(() => { try { localStorage.setItem('ag_cards_view', JSON.stringify({ kind })) } catch {} }, [kind])
  useEffect(() => { let live = true; loadAll().then(d => live && setData(d)); return () => { live = false } }, [])

  const cards = useMemo(() => (data ? SPORTS.flatMap(s => allCards(data[s.id], s.id, p.cards)) : []), [data, p.cards])
  const sets = useMemo(() => (data
    ? SPORTS.flatMap(S => buildSets(cards.filter(c => c.sport === S.id), data[S.id], S.id)).map(s => ({ ...s, claimed: !!p.sets?.[s.id] }))
    : []), [cards, data, p.sets])
  const totals = useMemo(() => {
    const t = { owned: 0, total: cards.length, rar: [0, 0, 0, 0], rarTotal: [0, 0, 0, 0], sport: Object.fromEntries(SPORTS.map(S => [S.id, { owned: 0, total: 0 }])) }
    for (const c of cards) {
      t.rarTotal[c.rank]++; t.sport[c.sport].total++
      if (c.owned) { t.owned++; t.rar[c.rank]++; t.sport[c.sport].owned++ }
    }
    return t
  }, [cards])
  const recent = useMemo(() => cards.filter(c => c.owned).sort((a, b) => b.seen - a.seen).slice(0, 12), [cards])
  // Each set kind: the football sets, then the basketball sets, under their own heading
  const shown = useMemo(() => SPORTS.map(S => {
    const list = sets.filter(s => s.kind === kind && s.sport === S.id)
    return { ...S, sets: list, done: list.filter(s => s.owned === s.total).length }
  }).filter(g => g.sets.length), [sets, kind])
  const openSet = open && sets.find(s => s.id === open)
  const openData = openSet ? data[openSet.sport] : null
  const claim = s => { if (claimSet(s.id, s.total)) { sfx('coins'); haptic('success') } }   // a set pays coins too
  const readyToClaim = sets.filter(s => s.owned === s.total && !s.claimed).length

  // A big set reads better in sections (a franchise: by position and era)
  const sections = useMemo(() => {
    if (!openSet) return []
    const sorted = [...openSet.cards].sort((a, b) => b.rank - a.rank || a.player.name.localeCompare(b.player.name))
    if (openSet.kind !== 'team' || sorted.length <= 12) return [{ label: null, cards: sorted }]
    const posOrder = Object.keys(openData.pools)
    const groups = new Map()
    for (const c of sorted) {
      const k = `${openData.posLabel[c.pos]} · ${c.mode === 'all-time' ? 'ALL-TIME' : 'CURRENT'}`
      if (!groups.has(k)) groups.set(k, { cards: [], order: posOrder.indexOf(c.pos) * 2 + (c.mode === 'all-time' ? 1 : 0) })
      groups.get(k).cards.push(c)
    }
    return [...groups.entries()].sort((a, b) => a[1].order - b[1].order).map(([label, g]) => ({ label, cards: g.cards }))
  }, [openSet, openData])

  return (
    <div className={`ag-screen ag-screen--${startSport}`}>
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">COLLECTION · {Object.keys(p.cards).length} CARDS</span>
          <h1 className="ag-h1">{hall ? 'The Hall' : 'Cards'}</h1>
        </div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
      </div>
      {hall}

      <div className="ag-screen-body">
        <div className="ag-card ag-coll-sum ag-pop" style={{ '--d': '0ms' }}>
          <div className="ag-coll-main">
            <span className="ag-coll-num">{totals.owned}<small>/{totals.total}</small></span>
            <span className="ag-coll-bar"><span style={{ width: `${totals.total ? (totals.owned / totals.total) * 100 : 0}%` }} /></span>
          </div>
          {data && (
            <div className="ag-coll-sports">
              {SPORTS.map(S => (
                <span key={S.id} className="ag-coll-sport">
                  <S.Icon size={13} /> {S.label} <b>{totals.sport[S.id].owned}</b><small>/{totals.sport[S.id].total}</small>
                </span>
              ))}
            </div>
          )}
          <div className="ag-coll-rar">
            {[3, 2, 1, 0].map(r => (
              <span key={r} className={`ag-rar-pill ag-rar-${r}`}><b>{totals.rar[r]}</b>/{totals.rarTotal[r]} {RARITIES[r]}</span>
            ))}
          </div>
          {readyToClaim > 0 && <div className="ag-coll-ready"><IconGift size={14} /> {readyToClaim} set{readyToClaim > 1 ? 's' : ''} complete — open to claim</div>}
        </div>

        {!data && <PassLoader label="Loading cards" />}

        {data && !openSet && recent.length === 0 && <EmptyState kind="cards" title="No cards yet">Every player revealed in a spin lands here.</EmptyState>}

        {data && !openSet && recent.length > 0 && (
          <section className="ag-pop" style={{ '--d': '40ms' }}>
            <div className="ag-row-head"><span className="ag-eyebrow">RECENT PULLS</span></div>
            <div className="ag-recent">
              {recent.map((c, i) => <Card key={c.key} c={c} data={data[c.sport]} i={i} small mark />)}
            </div>
          </section>
        )}

        {data && openSet ? (
          <section className="ag-set-view ag-pop" style={{ '--d': '0ms' }}>
            <button className="ag-set-back" onClick={() => setOpen(null)}><IconArrow size={16} style={{ transform: 'rotate(180deg)' }} /> ALL SETS</button>
            <div className="ag-set-head" style={{ '--tc': openSet.color ?? (openSet.gold ? '#D4AF37' : openSet.purple ? '#a855f7' : '#5EDBD8') }}>
              {openSet.logo ? <img src={openSet.logo} alt="" className="ag-set-logo" /> : <span className="ag-set-logo ag-set-logo--icon">{openSet.gold ? <IconCrown size={22} /> : <IconStar size={22} />}</span>}
              <span className="ag-set-name">{openSet.title}</span>
              <span className="ag-set-count">{openSet.owned}/{openSet.total}</span>
            </div>
            <div className="ag-set-sub">{openSet.sport === 'bucket' ? 'Basketball' : 'Football'} · {openSet.sub} · worth {setReward(openSet.total)} XP</div>
            {openSet.owned === openSet.total && !openSet.claimed && (
              <button className="ag-btn ag-btn--gold ag-set-claim" onClick={() => claim(openSet)}><IconGift size={18} /> SET COMPLETE · CLAIM <span className="gain"><XpIco /> +{setReward(openSet.total)}</span></button>
            )}
            <div className="ag-ct-grid">
              {sections.map(sec => (
                <SectionCards key={sec.label ?? 'all'} sec={sec} data={openData} color={openSet.color} />
              ))}
            </div>
          </section>
        ) : data && (
          <>
            <div className="ag-chips ag-chips--scroll ag-pop" style={{ '--d': '70ms' }}>
              {KINDS.map(k => <button key={k.id} className={`ag-chip${kind === k.id ? ' is-on' : ''}`} onClick={() => setKind(k.id)}>{k.label}</button>)}
            </div>
            {shown.map(g => (
              <section key={`${kind}|${g.id}`} className="ag-sets-group" aria-label={g.label}>
                <div className="ag-sets-h"><g.Icon size={14} /><span>{g.label}</span><i /><small>{g.done}/{g.sets.length} COMPLETE</small></div>
                <div className={`ag-sets${kind === 'team' ? '' : ' ag-sets--wide'}`}>
                  {g.sets.map((s, i) => <SetTile key={s.id} s={s} i={i} onOpen={() => setOpen(s.id)} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function SectionCards({ sec, data, color }) {
  return (
    <>
      {sec.label && <div className="ag-section-h"><span>{sec.label}</span><i /></div>}
      {sec.cards.map((c, i) => <Card key={c.key} c={c} data={data} color={color} i={i} />)}
    </>
  )
}
