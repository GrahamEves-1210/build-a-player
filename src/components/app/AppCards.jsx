import { useEffect, useMemo, useState } from 'react'
import { useProgress, cardKey, rarityRank, RARITIES, claimSet, setReward } from '../../lib/progress'
import { HEADSHOT_BASE } from '../../utils/simulation'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconCheck, IconGift } from './icons'

// Card binder (dock → Cards). Every player a spin lands on is collected;
// cards are grouped into team sets per position and mode. Rosters are loaded
// on demand so the other sport's data only downloads when it's opened.

const NFL_POS = [['qb', 'QB'], ['rb', 'RB'], ['wr', 'WR'], ['te', 'TE'], ['db', 'DB']]
const NBA_POS = [['guard', 'GUARDS'], ['big', 'BIGS']]

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
    teams: teams.TEAMS,
    logo: t => `/logos/${t}.png`,
    photo: name => { const id = hs.default[name]; return id ? `${HEADSHOT_BASE}/${id}.webp` : null },
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
    teams: teams.NBA_TEAMS,
    logo: t => `/logos/nba/${t}.png`,
    photo: name => { const id = hs.default[name]; return id ? `${HEADSHOT_BASE}/nba/${id}.webp` : null },
  }
}
const cache = {}
const loadSport = s => (cache[s] ??= (s === 'bucket' ? loadNba() : loadNfl()))

const generic = skin => {
  if (!skin) return '/genericdark.webp'
  const r = parseInt(skin.slice(1, 3), 16), g = parseInt(skin.slice(3, 5), 16), b = parseInt(skin.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '/genericlight.webp' : '/genericdark.webp'
}
const lastName = n => { const parts = n.split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : n }

function Card({ player, rank, owned, count, data, color, i }) {
  const photo = data.photo(player.name) ?? generic(player.skin)
  return (
    <div className={`ag-ct ag-rar-${rank}${owned ? '' : ' is-locked'}`} style={{ '--tc': player.color || color, '--d': `${i * 25}ms` }}>
      <div className="ag-ct-photo">
        <img src={photo} alt="" loading="lazy" draggable={false} onError={e => { e.currentTarget.src = generic(player.skin) }} />
        {!owned && <span className="ag-ct-q">?</span>}
      </div>
      <div className="ag-ct-foot">
        <span className="ag-ct-name">{lastName(player.name)}</span>
        <span className="ag-ct-rar">{RARITIES[rank]}</span>
      </div>
      {player.years && <span className="ag-ct-years">{player.years}</span>}
      {owned && count > 1 && <span className="ag-ct-count">×{count}</span>}
    </div>
  )
}

export default function AppCards({ sport: startSport, onClose }) {
  const p = useProgress()
  const saved = (() => { try { return JSON.parse(localStorage.getItem('ag_cards_view')) || {} } catch { return {} } })()
  const [sport, setSport] = useState(saved.sport ?? (startSport === 'bucket' ? 'bucket' : 'nfl'))
  const [pos, setPos] = useState(saved.pos ?? (startSport === 'bucket' ? 'guard' : 'qb'))
  const [mode, setMode] = useState(saved.mode ?? 'classic')
  const [data, setData] = useState(null)
  const [team, setTeam] = useState(null)

  useEffect(() => { try { localStorage.setItem('ag_cards_view', JSON.stringify({ sport, pos, mode })) } catch {} }, [sport, pos, mode])
  useEffect(() => { let live = true; setData(null); loadSport(sport).then(d => live && setData(d)); return () => { live = false } }, [sport])

  const switchSport = s => { setSport(s); setPos(s === 'bucket' ? 'guard' : 'qb'); setTeam(null) }
  const positions = sport === 'bucket' ? NBA_POS : NFL_POS
  const pool = data?.pools[pos]?.[mode] ?? null

  const sets = useMemo(() => {
    if (!pool || !data) return []
    const byTeam = new Map()
    for (const pl of pool) {
      if (!byTeam.has(pl.team)) byTeam.set(pl.team, [])
      byTeam.get(pl.team).push(pl)
    }
    return [...byTeam.entries()].map(([short, players]) => {
      const meta = data.teams.find(t => t.short === short) ?? { short, name: short, color: players[0]?.color }
      const cards = players.map(pl => {
        const k = cardKey(sport, pos, mode, pl.name, pl.team)
        return { player: pl, rank: rarityRank(pool, pl), owned: !!p.cards[k], count: p.cards[k]?.[0] ?? 0 }
      }).sort((a, b) => b.rank - a.rank || a.player.name.localeCompare(b.player.name))
      const owned = cards.filter(c => c.owned).length
      const setId = `${sport}|${pos}|${mode}|${short}`
      return { short, meta, cards, owned, total: cards.length, setId, claimed: !!p.sets?.[setId] }
    }).sort((a, b) => a.short.localeCompare(b.short))
  }, [pool, data, p.cards, p.sets, sport, pos, mode])

  const totals = useMemo(() => {
    const t = { owned: 0, total: 0, rar: [0, 0, 0, 0], rarTotal: [0, 0, 0, 0] }
    for (const s of sets) for (const c of s.cards) {
      t.total++; t.rarTotal[c.rank]++
      if (c.owned) { t.owned++; t.rar[c.rank]++ }
    }
    return t
  }, [sets])

  const open = team && sets.find(s => s.short === team)
  const claim = s => { if (claimSet(s.setId, s.total)) { sfx('claim'); haptic('success') } }

  return (
    <div className={`ag-screen ag-screen--${startSport}`}>
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">COLLECTION · {Object.keys(p.cards).length} CARDS</span>
          <h1 className="ag-h1">Cards</h1>
        </div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
      </div>

      <div className="ag-screen-body">
        <div className="ag-seg ag-pop" style={{ '--d': '0ms' }}>
          <button className={sport === 'nfl' ? 'is-on' : ''} onClick={() => switchSport('nfl')}>FOOTBALL</button>
          <button className={sport === 'bucket' ? 'is-on' : ''} onClick={() => switchSport('bucket')}>BASKETBALL</button>
        </div>
        <div className="ag-filter ag-pop" style={{ '--d': '40ms' }}>
          <div className="ag-chips">
            {positions.map(([id, label]) => (
              <button key={id} className={`ag-chip${pos === id ? ' is-on' : ''}`} onClick={() => { setPos(id); setTeam(null) }}>{label}</button>
            ))}
          </div>
          <div className="ag-chips">
            <button className={`ag-chip${mode === 'classic' ? ' is-on' : ''}`} onClick={() => { setMode('classic'); setTeam(null) }}>CURRENT</button>
            <button className={`ag-chip ag-chip--gold${mode === 'all-time' ? ' is-on' : ''}`} onClick={() => { setMode('all-time'); setTeam(null) }}>ALL-TIME</button>
          </div>
        </div>

        <div className="ag-card ag-coll-sum ag-pop" style={{ '--d': '80ms' }}>
          <div className="ag-coll-main">
            <span className="ag-coll-num">{totals.owned}<small>/{totals.total}</small></span>
            <span className="ag-coll-bar"><span style={{ width: `${totals.total ? (totals.owned / totals.total) * 100 : 0}%` }} /></span>
          </div>
          <div className="ag-coll-rar">
            {[3, 2, 1, 0].map(r => (
              <span key={r} className={`ag-rar-pill ag-rar-${r}`}><b>{totals.rar[r]}</b>/{totals.rarTotal[r]} {RARITIES[r]}</span>
            ))}
          </div>
        </div>

        {!data && <div className="ag-board-empty">Loading cards…</div>}

        {open ? (
          <section className="ag-set-view ag-pop" style={{ '--d': '0ms' }}>
            <div className="ag-set-head" style={{ '--tc': open.meta.color }}>
              <button className="ag-menu-back" onClick={() => setTeam(null)}>‹ ALL TEAMS</button>
              <img src={data.logo(open.short)} alt="" className="ag-set-logo" />
              <span className="ag-set-name">{open.meta.name}</span>
              <span className="ag-set-count">{open.owned}/{open.total}</span>
            </div>
            {open.owned === open.total && !open.claimed && (
              <button className="ag-btn ag-btn--gold ag-set-claim" onClick={() => claim(open)}><IconGift size={18} /> SET COMPLETE · CLAIM +{setReward(open.total)} XP</button>
            )}
            <div className="ag-ct-grid">
              {open.cards.map((c, i) => <Card key={c.player.name} {...c} data={data} color={open.meta.color} i={i} />)}
            </div>
          </section>
        ) : (
          <div className="ag-sets">
            {sets.map((s, i) => (
              <button key={s.short} className={`ag-set${s.owned === s.total ? ' is-complete' : ''}${s.owned === 0 ? ' is-empty' : ''}`}
                style={{ '--tc': s.meta.color, '--d': `${Math.min(i, 16) * 18}ms` }} onClick={() => setTeam(s.short)}>
                <img src={data.logo(s.short)} alt="" className="ag-set-tile-logo" loading="lazy" />
                <span className="ag-set-tile-short">{s.short}</span>
                <span className="ag-set-tile-bar"><span style={{ width: `${(s.owned / s.total) * 100}%` }} /></span>
                <span className="ag-set-tile-n">{s.owned}/{s.total}</span>
                {s.owned === s.total && (s.claimed ? <span className="ag-set-tick"><IconCheck size={12} /></span> : <span className="ag-set-gift"><IconGift size={14} /></span>)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
