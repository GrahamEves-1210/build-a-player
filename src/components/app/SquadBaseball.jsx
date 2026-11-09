import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BASEBALL_SPOTS } from '../../lib/squad'
import { lineupOf, teamGrade, faceOf, seasonBox, seasonBoxReady, seasonBoxSoon, isTeamResult } from '../../lib/squadSeason'
import { ovrOf, nameOf, BAT_SPOTS, PIT_SPOTS, teamRow, photoOf, moreLine, rate3, baseballSchedule } from '../../lib/squadBaseball'
import { Face, lastName, fmt } from './SquadSeason'
import { sfx, haptic } from '../../lib/juice'
import { IconClose, IconTrophy, IconCaret } from './icons'
import { TrophyArt, TrophyDefs } from './TrophyArt'

// SQUAD BUILDER, baseball (lib/squadBaseball.js): the ready screen's club (the lineup on the diamond, the batting
// order, the rotation and the closer) and the season as the club played it (the record, the builds' lines, the
// awards, October, the division, every man's line and every game, tap one for its box score). Loaded only with
// a baseball squad (AppSquad lazy-loads it). The builds are labelled with the player's name (`owner`).

const logo = short => (short ? `/logos/mlb/${short}.png` : null)
const Crest = ({ short, size = 22 }) => (short ? <img className="sqb-crest" src={logo(short)} alt="" loading="lazy" style={{ width: size, height: size }} /> : null)
const ipOf = outs => `${Math.floor((outs ?? 0) / 3)}.${(outs ?? 0) % 3}`
const ord = n => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const reducedMotion = () => { try { return document.documentElement.classList.contains('bap-reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const lowStamina = build => (build?.stamina?.val ?? 9) < 5

// ── The ready screen: the club ───────────────────────────────────────────────
// The diamond: each build at the spot it was picked for, the club's regulars around them. Tap a build, then
// another spot in the lineup (or on the staff) to move it there: two builds trade places.
const FIELD_XY = { C: [50, 86], '1B': [86, 65], '2B': [67, 44], SS: [33, 44], '3B': [14, 65], LF: [15, 24], CF: [50, 12], RF: [85, 24], DH: [86, 88] }
function useMover(squad, setSquad, L) {
  const [sel, setSel] = useState(null)
  const [bad, setBad] = useState(null)
  const tap = i => {
    const here = L.spots[i]?.you?.id
    if (!sel) { if (here) { setSel(here); sfx('tap'); haptic('light') } return }
    if (here === sel) { setSel(null); return }
    const from = L.spots.findIndex(x => x.you?.id === sel)
    if (BASEBALL_SPOTS[from]?.pos !== BASEBALL_SPOTS[i]?.pos) {
      if (here) { setSel(here); sfx('tap') } else { setBad({ i, k: Date.now() }); sfx('deny'); haptic('light') }
      return
    }
    const lineup = Object.fromEntries(L.spots.filter(x => x.you).map(x => [x.you.id, x.spot]))
    lineup[sel] = i
    if (here) lineup[here] = from
    setSquad({ ...squad, lineup })
    setSel(null); sfx('drop'); haptic('light')
  }
  return { sel, bad, tap, clear: () => setSel(null) }
}
function SpotCard({ x, i, owner, order, mover, xy }) {
  const sp = BASEBALL_SPOTS[i], s = x.you
  const picked = s && mover.sel === s.id
  const target = mover.sel && !picked && BASEBALL_SPOTS[i].pos === 'bat'
  return (
    <button className={`sq-spot sqb-spot${s ? ' is-mine' : ''}${x.open ? ' is-open' : ''}${picked ? ' is-picked' : ''}${target ? ' is-target' : ''}${mover.bad?.i === i ? ' is-bad' : ''}`}
      style={{ left: `${xy[0]}%`, top: `${xy[1]}%` }} onClick={() => mover.tap(i)} aria-label={`${sp.name}: ${s ? `${nameOf('bat', s.build)}, ${owner}` : x.real ? x.real.name : 'platoon'}`}>
      {s ? <Face src={faceOf(s.build)} name={sp.label} mine size={40} /> : <Face src={x.real?.photo} name={x.real?.name ?? sp.label} size={40} />}
      <span className="sq-spot-lbl">{sp.label}</span>
      {order != null && <span className="sqb-order">{order}</span>}
      <b className="sq-spot-name">{s ? nameOf('bat', s.build) : x.real ? lastName(x.real.name) : 'Platoon'}</b>
      <small className="sq-spot-ovr">{s ? `${ovrOf('bat', s.build)} · ${owner}` : x.real ? `${x.real.ovr}${x.moved ? ` · from ${x.real.role}` : ''}` : 'Bench bats'}</small>
    </button>
  )
}
export function BaseballBoard({ squad, setSquad, owner }) {
  const L = useMemo(() => lineupOf(squad), [squad])
  const mover = useMover(squad, setSquad, L)
  const order = L.order
  const card = BAT_SPOTS.map(i => ({ i, x: L.spots[i], n: order[i] })).sort((a, b) => a.n - b.n)
  const pen = L.pen.filter(p => p.role === 'SP' || p.role === 'CL')
  return (
    <>
      <section className="sq-board-wrap sqb-wrap ag-pop" style={{ '--d': '80ms' }}>
        <div className="ag-card-head"><span className="ag-eyebrow">THE LINEUP · {owner.toUpperCase()}'S BUILDS IN RED</span></div>
        <div className="sq-board sqb-field">
          <svg className="sq-court sqb-diamond" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M50 92 L2 44 M50 92 L98 44" />
            <path d="M2 44 Q50 -12 98 44" />
            <path d="M50 88 L76 64 L50 40 L24 64 Z" />
            <circle cx="50" cy="65" r="2.6" />
            <path d="M20 68 Q50 28 80 68" />
          </svg>
          {BAT_SPOTS.map(i => <SpotCard key={`${i}-${mover.bad?.i === i ? mover.bad.k : 0}`} x={L.spots[i]} i={i} owner={owner} order={order[i]} mover={mover} xy={FIELD_XY[BASEBALL_SPOTS[i].label]} />)}
        </div>
        <p className="sq-board-note">{mover.sel ? 'Now tap the spot to move them to.' : 'Tap a build, then another spot to move it. A regular who loses his spot moves to an open one, or goes to the bench.'}</p>
        {L.benched.length > 0 && <span className="sq-bench">To the bench: {L.benched.map(p => lastName(p.name)).join(', ')}</span>}
      </section>
      <section className="sq-card sqb-card ag-pop" style={{ '--d': '100ms' }}>
        <div className="ag-card-head"><span className="ag-eyebrow">THE BATTING ORDER</span></div>
        {card.map(({ i, x, n }) => {
          const s = x.you
          return (
            <div key={i} className={`sqb-row${s ? ' is-mine' : ''}${x.open ? ' is-open' : ''}`}>
              <span className="sqb-row-n">{n}</span>
              {s ? <Face src={faceOf(s.build)} name={BASEBALL_SPOTS[i].label} mine size={28} /> : <Face src={x.real?.photo} name={x.real?.name ?? '–'} size={28} />}
              <span className="sqb-row-who"><b>{s ? nameOf('bat', s.build) : x.real ? x.real.name : 'Platoon'}</b><small>{BASEBALL_SPOTS[i].label}{s ? ` · ${owner}` : x.real ? '' : ' · the club\'s bench bats'}</small></span>
              <span className="sqb-row-o">{s ? ovrOf('bat', s.build) : x.real?.ovr ?? ''}</span>
            </div>
          )
        })}
      </section>
      <section className="sq-card sqb-card ag-pop" style={{ '--d': '120ms' }}>
        <div className="ag-card-head"><span className="ag-eyebrow">THE ROTATION AND THE CLOSER</span></div>
        {PIT_SPOTS.map(i => {
          const x = L.spots[i], s = x.you, sp = BASEBALL_SPOTS[i]
          const picked = s && mover.sel === s.id
          const target = mover.sel && !picked && sp.pos === 'pit' && BASEBALL_SPOTS[L.spots.findIndex(y => y.you?.id === mover.sel)]?.pos === 'pit'
          return (
            <button key={`${i}-${mover.bad?.i === i ? mover.bad.k : 0}`} className={`sqb-row sqb-row--btn${s ? ' is-mine' : ''}${x.open ? ' is-open' : ''}${picked ? ' is-picked' : ''}${target ? ' is-target' : ''}${mover.bad?.i === i ? ' is-bad' : ''}`} onClick={() => mover.tap(i)}>
              <span className="sqb-row-n">{sp.label}</span>
              {s ? <Face src={faceOf(s.build)} name={sp.label} mine size={28} /> : <Face src={x.real?.photo} name={x.real?.name ?? '–'} size={28} />}
              <span className="sqb-row-who">
                <b>{s ? nameOf('pit', s.build) : x.real ? x.real.name : sp.role === 'SP' ? 'Spot starter' : 'Closer by committee'}</b>
                <small>{sp.name}{s ? ` · ${owner}` : ''}{s && sp.role === 'SP' && lowStamina(s.build) ? ' · SHORT OUTINGS' : ''}</small>
              </span>
              <span className="sqb-row-o">{s ? ovrOf('pit', s.build, sp.role) : x.real?.ovr ?? ''}</span>
            </button>
          )
        })}
        {pen.length > 0 && <span className="sq-bench">To the bullpen: {pen.map(p => lastName(p.name)).join(', ')}</span>}
      </section>
    </>
  )
}

// ── The season ───────────────────────────────────────────────────────────────
export function baseballOutcome(r) {
  const series = (r.rounds ?? []).filter(x => x.type === 'series')
  const last = series[series.length - 1]
  if (r.champion) return 'World Series Champions'
  if (!r.playoffs) return `Missed the postseason · ${ord(r.divRank ?? 5)} in the ${r.league ?? ''} ${r.division ?? ''}${r.gb ? `, ${r.gb} GB` : ''}`
  if (!last) return 'Postseason'
  if (last.short === 'WS') return `${r.league} Champions · lost the World Series (${last.wins}-${last.losses})`
  return `Lost the ${last.short} to ${last.opp} (${last.wins}-${last.losses})`
}
const Hero = memo(function Hero({ r, rec, sub, eyebrow }) {
  const team = teamRow(r.team)
  return (
    <div className={`sq-hero sqb-hero ag-pop${r.champion && !sub ? ' is-champ' : ''}`} style={{ '--tc': team?.color ?? 'var(--ag-a2)' }}>
      <img className="sq-hero-logo" src={logo(r.team)} alt="" />
      <span className="sq-hero-txt">
        <span className="ag-eyebrow">{eyebrow ?? `${team?.name ?? r.team} · ${r.league ?? ''} ${r.division ?? ''}`}</span>
        <b className="sq-hero-rec">{rec ? rec[0] : r.wins}<i>–</i>{rec ? rec[1] : r.losses}</b>
        <small className="sq-hero-out">{!sub && r.champion && <IconTrophy size={14} />} {sub ?? baseballOutcome(r)}</small>
      </span>
    </div>
  )
})
const ClubLine = memo(function ClubLine({ r, games }) {
  const st = r.strength ?? {}
  const delta = (now, was) => { const a = teamGrade('baseball', now), b = teamGrade('baseball', was); return a === b ? null : <i className={(now ?? 0) > (was ?? 0) ? 'is-up' : 'is-down'}>from {b}</i> }
  const reg = games.filter(g => !g.po)
  const home = reg.filter(g => g.home), away = reg.filter(g => !g.home)
  let best = 0, run = 0
  for (const g of reg) { run = g.won ? run + 1 : 0; best = Math.max(best, run) }
  const diff = (r.rs ?? 0) - (r.ra ?? 0)
  const more = [`RUN DIFF ${diff > 0 ? '+' : ''}${diff}`, `HOME ${home.filter(g => g.won).length}-${home.filter(g => !g.won).length}`, `ROAD ${away.filter(g => g.won).length}-${away.filter(g => !g.won).length}`, `${best}-GAME WIN STREAK`, `${reg.filter(g => g.wo === 1).length} WALK-OFFS`]
  return (
    <section className="sq-card sq-tl ag-pop" style={{ '--d': '40ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE CLUB · 162 GAMES</span></div>
      <div className="sq-tl-cells">
        <span><small>RUNS</small><b>{r.rs}</b></span>
        <span><small>ALLOWED</small><b>{r.ra}</b></span>
        <span><small>OFFENSE</small><b>{teamGrade('baseball', st.off)}</b>{delta(st.off, st.baseOff)}</span>
        <span><small>DEFENSE</small><b>{teamGrade('baseball', st.def)}</b>{delta(st.def, st.baseDef)}</span>
      </div>
      <p className="sq-tl-more">{more.join(' · ')}</p>
    </section>
  )
})
const BuildLines = memo(function BuildLines({ r, squad, owner }) {
  const bySlot = Object.fromEntries((squad?.slots ?? []).map(s => [s.id, s]))
  const byK = Object.fromEntries((r.roster ?? []).map(p => [p.k, p]))
  return (
    <section className="sq-lines ag-pop" style={{ '--d': '80ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{owner.toUpperCase()}'S BUILDS</span></div>
      {r.lines.map(l => {
        const p = byK[`b:${l.id}`], t = r.tot?.[`b:${l.id}`] ?? {}
        const ps = t.ps ? (l.pos === 'bat' ? [`OCTOBER ${rate3(t.ps.avg)}, ${t.ps.hr} HR, ${t.ps.rbi} RBI`] : [`OCTOBER ${t.ps.w}-${t.ps.l}, ${(t.ps.era ?? 0).toFixed(2)} ERA${t.ps.sv ? `, ${t.ps.sv} SV` : ''}`]) : []
        const extra = [...(l.awards ?? []).slice(1).map(a => a.toUpperCase()), ...(l.honors ?? []).slice(l.awards?.length ? 0 : 1)]
        return (
          <div key={l.id} className={`sq-line${l.awards?.length ? ' is-award' : ''}`}>
            <div className="sq-line-top">
              <Face src={l.face} name={l.tag} mine />
              <span className="sq-row-txt">
                <b>{l.name ?? BASEBALL_SPOTS[l.spot]?.name}</b>
                <small>{l.tag}{p?.order ? ` · BATS ${ord(p.order).toUpperCase()}` : ''} · {owner}{bySlot[l.id] ? '' : ' · cut'}</small>
              </span>
              {l.award?.won && <span className="sq-award"><IconTrophy size={13} /> {l.award.name.toUpperCase()}</span>}
              {!l.award?.won && l.honor && <span className="sq-honor">{l.honor}</span>}
              <span className="sq-ovr"><b>{l.ovr}</b><small>OVR</small></span>
            </div>
            <div className="sq-stats">{l.stats.map(([k, v]) => <span key={k}><b>{fmt(v)}</b><small>{k}</small></span>)}</div>
            <p className="sq-line-more">{[...extra, ...ps, ...moreLine(p ?? { pos: l.pos, role: l.role }, t)].join(' · ')}</p>
          </div>
        )
      })}
    </section>
  )
})

// who an award went to: a man of the club's (a build by its name and the player's), or the field's
function whoOf(w, r, owner, faces) {
  if (!w) return null
  if (w.k) {
    const p = r.roster?.find(x => x.k === w.k)
    const mine = !!p?.s
    return { name: mine ? p.n : lastName(p?.n), sub: `${p?.tag ?? ''} · ${mine ? owner : r.team}`, mine, face: mine ? faces[p.s] : photoOf(p), t: r.tot?.[w.k], pos: p?.pos }
  }
  return { name: lastName(w.name), sub: `${w.role ?? ''} · ${w.team ?? ''}`, team: w.team, t: w, pos: w.hr != null ? 'bat' : 'pit' }
}
const AWARD_ROWS = [['mvp', 'MVP'], ['cyYoung', 'CY YOUNG'], ['roy', 'ROOKIE'], ['reliever', 'RELIEVER'], ['hankAaron', 'HANK AARON'], ['tripleCrown', 'TRIPLE CROWN'], ['wsMvp', 'WS MVP'], ['lcsMvp', 'LCS MVP']]
const Awards = memo(function Awards({ r, owner, faces }) {
  const A = r.awards ?? {}
  const rows = AWARD_ROWS.filter(([k]) => A[k]?.winner)
  if (!rows.length) return null
  const val = w => (w?.t ? (w.pos === 'bat' ? [w.t.war != null ? (+w.t.war).toFixed(1) : '—', 'WAR'] : (w.t.sv ?? 0) >= 15 ? [w.t.sv, 'SV'] : [(w.t.era ?? 0).toFixed(2), 'ERA']) : null)
  return (
    <section className="sq-card ag-pop" style={{ '--d': '100ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE AWARDS · {r.league}</span></div>
      {rows.map(([k, label]) => {
        const w = whoOf(A[k].winner, r, owner, faces), v = val(w)
        return (
          <div key={k} className={`sq-lead${w?.mine ? ' is-mine' : ''}`}>
            <span className="sq-lead-lbl">{label}</span>
            {w?.team ? <Crest short={w.team} size={26} /> : <Face src={w?.face} name={w?.name} mine={w?.mine} size={28} />}
            <span className="sq-lead-who"><b>{w?.name}</b><small>{w?.sub}</small></span>
            {v && <span className="sq-lead-val"><b>{v[0]}</b><small>{v[1]}</small></span>}
          </div>
        )
      })}
      {r.race?.length > 0 && (
        <div className="sq-race sqb-race">
          <span className="sq-mates-pos">{r.league} HOME RUN RACE</span>
          {r.race.map((x, i) => {
            const p = x.k ? r.roster.find(y => y.k === x.k) : null
            const mine = !!p?.s
            return (
              <div key={`${x.k ?? x.name}-${i}`} className={`sqb-race-row${mine ? ' is-mine' : ''}${p ? ' is-ours' : ''}`}>
                <span className="sqb-race-n">{i + 1}</span>
                <Crest short={x.team ?? r.team} size={20} />
                <span className="sqb-race-who"><b>{mine ? p.n : lastName(p?.n ?? x.name)}</b>{mine && <small>{p.tag} · {owner}</small>}</span>
                <b className="sqb-race-v">{x.hr}</b>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
})

// October: the rounds (tap one for its games)
const October = memo(function October({ r, games, onOpen }) {
  const [open, setOpen] = useState(null)
  if (!r.playoffs || !r.rounds?.length) return null
  return (
    <section className="sq-po ag-pop" style={{ '--d': '120ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">OCTOBER · {ord(r.seed ?? 6).toUpperCase()} SEED IN THE {r.league}</span></div>
      {r.rounds.map((x, i) => {
        if (x.type === 'bye') return <div key={i} className="sq-po-row is-w"><span>{x.short} · BYE</span><span /><b>—</b></div>
        const isOpen = open === i
        const gs = games.filter(g => g.po && g.ri === i)
        return (
          <div key={i} className="sq-po-grp">
            <button className={`sq-po-row${x.won ? ' is-w' : ' is-l'}`} onClick={() => { setOpen(isOpen ? null : i); sfx('tap') }} aria-expanded={isOpen}>
              <span>{x.name.toUpperCase()}</span>
              <Crest short={x.opp} size={24} />
              <b>{x.wins}-{x.losses}</b>
              <IconCaret dir={isOpen ? 'up' : 'down'} size={11} className="sq-po-caret" />
            </button>
            {isOpen && <div className="sq-po-games">{gs.map(g => <GameRow key={`p${g.i}`} g={g} onOpen={onOpen} />)}</div>}
          </div>
        )
      })}
    </section>
  )
})

// the division, and the wild card race
const Standings = memo(function Standings({ r }) {
  if (!r.standings?.length) return null
  const row = (x, i, wc) => (
    <div key={`${wc ? 'w' : 'd'}${x.short}`} className={`sqb-st-row${x.us ? ' is-mine' : ''}${wc && i === 2 ? ' is-cut' : ''}`}>
      <span>{wc ? (x.seed ?? '') : i + 1}</span>
      <span className="sqb-st-team"><Crest short={x.short} size={20} /><b>{teamRow(x.short)?.name ?? x.short}</b></span>
      <span>{x.w}</span><span>{x.l}</span><b>{wc ? (x.wcgb == null || x.wcgb === 0 ? '—' : x.wcgb > 0 ? `${x.wcgb}` : `+${-x.wcgb}`) : (x.gb ? x.gb : '—')}</b>
    </div>
  )
  // (the wild cards: the three after the division winners, and the next three chasing them)
  const wild = (r.wild ?? []).filter(x => !(x.cl === 'division' || x.cl === 'bye'))
  return (
    <section className="sq-card ag-pop" style={{ '--d': '140ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">{r.league} {(r.division ?? '').toUpperCase()}</span></div>
      <div className="sqb-st" role="table">
        <div className="sqb-st-row sqb-st-head" role="row"><span>#</span><span>CLUB</span><span>W</span><span>L</span><span>GB</span></div>
        {r.standings.map((x, i) => row(x, i, false))}
      </div>
      {wild.length > 0 && <>
        <span className="sq-mates-pos sqb-st-sub">{r.league} WILD CARD</span>
        <div className="sqb-st" role="table">
          <div className="sqb-st-row sqb-st-head" role="row"><span>#</span><span>CLUB</span><span>W</span><span>L</span><span>WCGB</span></div>
          {wild.slice(0, 5).map((x, i) => row(x, i, true))}
        </div>
      </>}
    </section>
  )
})

// every man's season: the lineup in batting order, then the staff (and what the rest of the club did)
const ClubLines = memo(function ClubLines({ r, owner, faces }) {
  const roster = r.roster ?? []
  const bats = roster.filter(p => p.pos === 'bat').sort((a, b) => a.order - b.order)
  const pits = roster.filter(p => p.pos === 'pit').sort((a, b) => a.spot - b.spot)
  const row = p => {
    const t = r.tot?.[p.k] ?? {}, mine = !!p.s
    const line = p.pos === 'bat' ? `${rate3(t.avg)} · ${t.hr} HR · ${t.rbi} RBI · ${rate3(t.ops)}` : p.role === 'SP' ? `${t.w}-${t.l} · ${(t.era ?? 0).toFixed(2)} · ${t.k} K` : `${t.sv} SV · ${(t.era ?? 0).toFixed(2)} · ${t.k} K`
    return (
      <div key={p.k} className={`sq-mate${mine ? ' is-mine' : ''}`}>
        <Face src={mine ? faces[p.s] : photoOf(p)} name={mine ? p.tag : p.n} mine={mine} size={26} />
        <span className="sq-mate-who"><b>{mine ? p.n : lastName(p.n)}</b><small>{p.pos === 'bat' ? `${p.order}. ` : ''}{p.tag} · {mine ? owner : p.o}{r.mates?.find(m => m.k === p.k)?.awards?.length ? ` · ${r.mates.find(m => m.k === p.k).awards[0].toUpperCase()}` : ''}</small></span>
        <span className="sq-mate-line">{line}</span>
      </div>
    )
  }
  const o = r.others ?? {}
  return (
    <section className="sq-card sq-mates ag-pop" style={{ '--d': '160ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE CLUB'S LINES</span></div>
      <div className="sq-mates-grp"><span className="sq-mates-pos">THE LINEUP</span>{bats.map(row)}
        <div className="sq-mate"><span className="tk-hs sq-face" style={{ width: 26, height: 26 }}>+</span><span className="sq-mate-who"><b>Platoon and bench</b><small>PINCH HITTERS, DAYS OFF</small></span><span className="sq-mate-line">{o.r ?? 0} R · {o.rbi ?? 0} RBI</span></div>
      </div>
      <div className="sq-mates-grp"><span className="sq-mates-pos">THE STAFF</span>{pits.map(row)}
        <div className="sq-mate"><span className="tk-hs sq-face" style={{ width: 26, height: 26 }}>+</span><span className="sq-mate-who"><b>The bullpen</b><small>SPOT STARTS AND RELIEF</small></span><span className="sq-mate-line">{o.w ?? 0}-{o.l ?? 0} · {o.ra ?? 0} R</span></div>
      </div>
    </section>
  )
})

// ── Every game ───────────────────────────────────────────────────────────────
const MONTHS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP']
const monthOf = g => { const m = String(g.date ?? '').slice(0, 3).toUpperCase(); return m === 'MAR' ? 'APR' : m === 'OCT' ? 'SEP' : m }
function GameRow({ g, onOpen }) {
  const Tag = onOpen ? 'button' : 'div'
  const tail = g.wo === 1 ? ' WO' : g.ot ? ` F/${9 + g.ot}` : ''
  return (
    <Tag className={`sq-game${g.won ? ' is-w' : ' is-l'}${g.po ? ' is-po' : ''}`} {...(onOpen && { onClick: () => onOpen(g), 'aria-label': `${g.label}, ${g.home ? 'vs' : 'at'} ${g.opp}, ${g.won ? 'won' : 'lost'} ${g.my} to ${g.op}` })}>
      <span className="sq-game-lbl">{g.po ? g.label : String(g.date ?? g.label).toUpperCase()}</span>
      <img src={logo(g.opp)} alt="" loading="lazy" />
      <span className="sq-game-opp">{g.home ? 'vs' : '@'} {g.opp}</span>
      <b className="sq-game-res"><i>{g.won ? 'W' : 'L'}</i> {g.my}-{g.op}{tail}</b>
      {onOpen && <IconCaret dir="right" size={11} className="sq-game-go" />}
    </Tag>
  )
}
const Schedule = memo(function Schedule({ games, onOpen }) {
  const reg = useMemo(() => games.filter(g => !g.po), [games])
  const [m, setM] = useState('SEP')
  const shown = reg.filter(g => monthOf(g) === m)
  return (
    <section className="sq-card ag-pop" style={{ '--d': '180ms' }}>
      <div className="ag-card-head"><span className="ag-eyebrow">THE SEASON · 162 GAMES</span></div>
      <div className="sq-log sqb-log" aria-hidden="true">{reg.map(g => <i key={g.i} className={g.won ? 'is-w' : 'is-l'} />)}</div>
      <div className="ag-seg sq-seg sqb-months" role="tablist" aria-label="Month">
        {MONTHS.map(x => <button key={x} role="tab" aria-selected={m === x} className={m === x ? 'is-on' : ''} onClick={() => { setM(x); sfx('tap') }}>{m === x && <span className="ag-seg-pill" />}{x}</button>)}
      </div>
      <div className="sq-games">{shown.map(g => <GameRow key={g.i} g={g} onOpen={onOpen} />)}</div>
    </section>
  )
})

// ── One game's box score ─────────────────────────────────────────────────────
const DEC = x => (x.w ? 'W' : x.l ? 'L' : x.sv ? 'S' : x.bs ? 'BS' : x.hld ? 'H' : '')
function BoxSheet({ r, g, box, owner, faces, onClose }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const game = (g.po ? box.po : box.reg)[g.i]
  if (!game) return null
  const roster = r.roster ?? []
  const bats = roster.filter(p => p.pos === 'bat').sort((a, b) => a.order - b.order)
  const pits = roster.filter(p => p.pos === 'pit' && game.s[p.k]).sort((a, b) => (b.role === 'SP') - (a.role === 'SP'))
  const sum = (list, k) => list.reduce((a, p) => a + (game.s[p.k]?.[k] ?? 0), 0)
  const restR = g.my - sum(bats, 'r'), restRbi = g.my - sum(bats, 'rbi'), penR = g.op - sum(pits, 'r')
  const opp = teamRow(g.opp)
  const name = p => (p.s ? <><Face src={faces[p.s]} name={p.tag} mine size={20} />{owner}</> : lastName(p.n))
  const where = g.po ? `${g.round} · GAME ${g.gm}` : `${String(g.date ?? '').toUpperCase()} · GAME ${g.i + 1}`
  return createPortal(
    <div className="ss-overlay sq-box-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ss-sheet sq-box" role="dialog" aria-modal="true" aria-labelledby="sq-box-title">
        <div className="ss-head">
          <span className="ag-eyebrow">{where} · {g.home ? 'VS' : 'AT'} {(opp?.name ?? g.opp).toUpperCase()}</span>
          <button className="ss-close" onClick={onClose} aria-label="Close"><IconClose size={15} /></button>
        </div>
        <div className={`sq-box-score${g.won ? ' is-w' : ' is-l'}`} id="sq-box-title">
          <span className="sq-box-team"><img src={logo(r.team)} alt="" /><b>{r.team}</b></span>
          <span className="sq-box-pts"><b>{g.my}</b><i>–</i><b>{g.op}</b></span>
          <span className="sq-box-team"><img src={logo(g.opp)} alt="" /><b>{g.opp}</b></span>
          <span className="sq-box-final">{g.won ? 'WIN' : 'LOSS'}{g.wo === 1 ? ' · WALK-OFF' : g.wo === -1 ? ' · WALKED OFF' : ''}{g.ot ? ` · ${9 + g.ot} INNINGS` : ''}</span>
        </div>
        <div className="sq-box-sec">
          <span className="sq-box-h">BATTING</span>
          <div className="sq-bt sqb-bt sqb-bt--bat" role="table">
            <div className="sq-bt-row sq-bt-head" role="row"><span>{r.team}</span>{['AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K'].map(h => <span key={h}>{h}</span>)}</div>
            {bats.map(p => {
              const x = game.s[p.k]
              return (
                <div key={p.k} className={`sq-bt-row${p.s ? ' is-mine' : ''}${x ? '' : ' is-dnp'}`} role="row">
                  <span className="sq-bt-name">{name(p)}<small>{p.tag}</small></span>
                  {x ? [x.ab, x.r, x.h, x.rbi, x.hr, x.bb, x.k].map((c, j) => <span key={j}>{c}</span>) : <span className="sq-bt-dnp">DID NOT PLAY</span>}
                </div>
              )
            })}
            {(restR > 0 || restRbi > 0) && <div className="sq-bt-row" role="row"><span className="sq-bt-name">Platoon and bench<small>REST</small></span><span>—</span><span>{restR}</span><span>—</span><span>{restRbi}</span><span>—</span><span>—</span><span>—</span></div>}
            <div className="sq-bt-row sq-bt-total" role="row"><span className="sq-bt-name">{r.team}<small>TEAM</small></span><span /><span>{g.my}</span><span /><span /><span /><span /><span /></div>
          </div>
        </div>
        <div className="sq-box-sec">
          <span className="sq-box-h">PITCHING</span>
          <div className="sq-bt sqb-bt sqb-bt--pit" role="table">
            <div className="sq-bt-row sq-bt-head" role="row"><span>{r.team}</span>{['IP', 'H', 'R', 'ER', 'BB', 'K', ''].map((h, j) => <span key={j}>{h}</span>)}</div>
            {pits.map(p => {
              const x = game.s[p.k]
              return (
                <div key={p.k} className={`sq-bt-row${p.s ? ' is-mine' : ''}`} role="row">
                  <span className="sq-bt-name">{name(p)}<small>{p.tag}</small></span>
                  {[ipOf(x.outs), x.h, x.r, x.er, x.bb, x.k, DEC(x)].map((c, j) => <span key={j}>{c}</span>)}
                </div>
              )
            })}
            {penR > 0 || !pits.length ? <div className="sq-bt-row" role="row"><span className="sq-bt-name">The bullpen<small>{pits.some(p => game.s[p.k]?.gs) ? 'RELIEF' : 'THE STAFF'}</small></span><span>—</span><span>—</span><span>{Math.max(0, penR)}</span><span>—</span><span>—</span><span>—</span><span /></div> : null}
            <div className="sq-bt-row sq-bt-total" role="row"><span className="sq-bt-name">{g.opp}<small>SCORED</small></span><span /><span /><span>{g.op}</span><span /><span /><span /><span /></div>
          </div>
          {pits.filter(p => game.s[p.k]?.bs).map(p => <p key={p.k} className="sq-cup-note sqb-box-note">Blown save: {p.s ? owner : lastName(p.n)} ({p.tag}){game.s[p.k].l ? ', and the loss' : game.s[p.k].w ? ', then the win on the walk-off' : ', then the club won it back'}.</p>)}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── The season playing out (a season just simmed): the games fill in, the record builds; then October ──
function Reveal({ r, games, onDone }) {
  const reg = useMemo(() => games.filter(g => !g.po), [games])
  const rounds = (r.rounds ?? []).filter(x => x.type === 'series')
  const [k, setK] = useState(0)
  const [po, setPo] = useState(-1)
  const [poDone, setPoDone] = useState(false)
  const doneRef = useRef(onDone); doneRef.current = onDone
  useEffect(() => {
    let t, i = 0
    const regTick = () => {
      i = Math.min(reg.length, i + 6); setK(i)
      if (i < reg.length) { t = setTimeout(regTick, 70); return }
      t = setTimeout(() => (rounds.length ? poTick(0) : doneRef.current()), 900)
    }
    const poTick = n => {
      setPo(n); setPoDone(false)
      t = setTimeout(() => {
        setPoDone(true); sfx(rounds[n]?.won ? 'claim' : 'tap')
        const more = n + 1 < rounds.length && rounds[n]?.won
        t = setTimeout(() => (more ? poTick(n + 1) : doneRef.current()), more ? 750 : 1100)
      }, 850)
    }
    t = setTimeout(regTick, 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = reg.slice(0, k)
  const w = shown.filter(g => g.won).length
  const sub = po < 0 ? (k < reg.length ? `GAME ${k} OF 162` : r.playoffs ? 'POSTSEASON BOUND' : 'MISSED THE POSTSEASON') : 'OCTOBER'
  return (
    <div className="sq-reveal">
      <Hero r={r} rec={[w, shown.length - w]} sub={sub} eyebrow={`${teamRow(r.team)?.name ?? r.team} · ${po < 0 ? 'REGULAR SEASON' : 'POSTSEASON'}`} />
      <section className="sq-po">
        <div className="sq-log sqb-log" aria-hidden="true">{reg.map((g, i) => <i key={i} className={i < k ? (g.won ? 'is-w' : 'is-l') : ''} />)}</div>
        {po < 0 && <div className="sq-games">{shown.slice(-4).reverse().map(g => <GameRow key={g.i} g={g} />)}</div>}
        {po >= 0 && rounds.slice(0, po + 1).map((x, i) => (
          <div key={i} className={`sq-po-row${i < po || poDone ? (x.won ? ' is-w' : ' is-l') : ''}`}>
            <span>{x.name.toUpperCase()}</span>
            <Crest short={x.opp} size={24} />
            <b>{i === po && !poDone ? 'LIVE' : `${x.wins}-${x.losses}`}</b>
          </div>
        ))}
      </section>
      <button className="ag-btn ag-btn--ghost sq-reveal-skip" onClick={() => { sfx('tap'); onDone() }}>SKIP TO THE RESULTS</button>
    </div>
  )
}

export function BaseballResult({ squad, owner, rewards, reveal = false, onRevealed }) {
  const raw = squad.last
  const r = useMemo(() => ({ ...raw, rounds: raw.rounds ?? [], lines: raw.lines ?? [], roster: raw.roster ?? [], tot: raw.tot ?? {} }), [raw])
  const games = useMemo(() => baseballSchedule(r), [r])
  const faces = useMemo(() => Object.fromEntries(r.lines.map(l => [l.id, l.face])), [r])
  const [playing, setPlaying] = useState(() => reveal && !reducedMotion())
  const finish = useCallback(() => { setPlaying(false); onRevealed?.() }, [onRevealed])
  useEffect(() => { if (reveal && !playing) onRevealed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // every game's box score, played back once when the page is idle (a tap before then plays it back on the spot)
  const [box, setBox] = useState(() => seasonBoxReady(raw))
  useEffect(() => (playing ? undefined : seasonBoxSoon(raw, setBox)), [raw, playing])
  const [open, setOpen] = useState(null)
  const canOpen = box !== null && isTeamResult(raw)
  const onOpen = useCallback(g => { setBox(b => (b === undefined ? seasonBox(raw) : b)); setOpen(g); sfx('tap') }, [raw])
  const close = useCallback(() => setOpen(null), [])
  if (playing) return <Reveal r={r} games={games} onDone={finish} />
  return (
    <>
      <Hero r={r} />
      {r.sandbox && <p className="sq-note">SANDBOX squad: just for fun, no XP or coins.</p>}
      <ClubLine r={r} games={games} />
      <BuildLines r={r} squad={squad} owner={owner} />
      {rewards}
      <Awards r={r} owner={owner} faces={faces} />
      <October r={r} games={games} onOpen={canOpen ? onOpen : null} />
      <Standings r={r} />
      <ClubLines r={r} owner={owner} faces={faces} />
      <Schedule games={games} onOpen={canOpen ? onOpen : null} />
      {open && box && <BoxSheet r={r} g={open} box={box} owner={owner} faces={faces} onClose={close} />}
    </>
  )
}
export default BaseballResult
// the World Series title ceremony's trophy: the Commissioner's Trophy (TrophyArt's 'ws'), drawn
export function BaseballTrophy() {
  return <span className="ag-ring-trophy sqb-ring-art"><TrophyDefs /><TrophyArt kind="ws" shine={1} /></span>
}
