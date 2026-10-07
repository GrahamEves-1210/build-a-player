import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LIVES, XP_CITY, XP_RUN, cityList, starOf, saveRun, clearRun, hoopsDuel, footballDuel, stealOptions, upgradeOptions, applyReward, afterDuel } from '../../lib/takeover'
import { playDelay } from '../../lib/hoops'
import { joinRoom, genCode, myVid } from '../../lib/live'
import { clean, blockedIds, MIN_GAP_MS } from '../../lib/chat'
import { valToGrade } from '../../utils/simulation'
import { getUsername } from '../../lib/discord'
import { sfx, haptic, confetti } from '../../lib/juice'
import { BlacktopChat } from './AppBlacktop'
import { IconClose, IconArrow, IconLock, IconCheck, IconFlame, IconChat, IconStar, IconProfile } from './icons'

// TAKEOVER — the road. The run (lib/takeover.js) is plain data saved on the
// device; this screen walks it: the route → the city's star → the duel → the
// reward → the next city. Duo: two runs share one road over a live room.

const gradeColor = v => (v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444')

export default function AppTakeover({ sport, run, setRun, user, pools, types, attrMap, photoFor, calcOvr, teams, ratings, onNewBuild, onExit }) {
  const isBucket = sport === 'bucket'
  const cities = useMemo(() => cityList(sport, teams, ratings), [sport, teams, ratings])
  const [screen, setScreen] = useState('map')      // map | city | duel | reward | over | duo
  const [duel, setDuel] = useState(null)            // { ...result, city, star } — the stop it was played at
  const [chatOpen, setChatOpen] = useState(false)
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null }), [user?.id]) // eslint-disable-line
  useEffect(() => { if (run) saveRun(run) }, [run])
  useEffect(() => { if (run?.over && screen === 'map') setScreen('over') }, [run?.over, screen])

  const city = run && !run.over ? cities[run.idx] : null
  const star = useMemo(() => (city ? starOf(city, pools[run.pos] ?? pools.guard ?? [], run.types, photoFor) : null), [city, pools, run?.pos, run?.types, photoFor])

  // ── Duo (two runs, one road) ────────────────────────────────────────────────
  const duo = useDuo({ enabled: !!run && run.mode === 'duo', run, setRun, me, user, cities, pools, photoFor, isBucket, calcOvr, onCity: () => setScreen('city') })

  const startDuel = () => {
    if (!run || !city || !star) return
    let d
    if (isBucket) {
      const partner = run.mode === 'duo' ? duo.partnerPlayer : null
      const partnerStar = partner ? starOf(city, pools[partner.pos] ?? pools.guard, partner.types, photoFor, star.player.name) : null
      d = { kind: 'hoops', ...hoopsDuel({ run, city, star, me: { name: me.name }, partner, partnerStar }) }
      d.win = d.winner === 0
    } else {
      const ovr = calcOvr(run.build)
      d = { kind: 'football', ...footballDuel({ run, city, star, myOvr: ovr }) }
      if (run.mode === 'duo' && duo.partnerPlayer) {
        const pd = footballDuel({ run: { ...run, seed: run.seed + 'p' }, city, star, myOvr: duo.partnerPlayer.ovr ?? ovr })
        d.partner = pd
        d.win = d.win || pd.win         // the city falls if either of you wins
      }
    }
    setDuel({ ...d, city, star }); setScreen('duel'); sfx('whistle'); haptic('medium')
  }
  const settle = won => {
    const at = duel?.city ?? city
    const next = { ...afterDuel({ ...run, total: cities.length }, at, won), total: cities.length }
    if (won) {
      window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp: XP_CITY, label: `${at.city} taken` } }))
      if (next.won) window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp: XP_RUN, label: 'TAKEOVER complete' } }))
    }
    setRun(next)
    if (run.mode === 'duo') duo.sync(next)
    setScreen(won && !next.over ? 'reward' : next.over ? 'over' : 'map')
  }
  const reward = (kind, type) => {
    const next = applyReward(run, { kind, type }, duel?.star ?? star)
    setRun(next); setScreen('map'); sfx('claim'); haptic('success')
  }

  if (!run) return null
  const ovr = calcOvr(run.build)
  const taken = new Set(run.taken)

  // ── Map ─────────────────────────────────────────────────────────────────────
  if (screen === 'map') {
    const nextCity = city
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head">
          <div>
            <span className="ag-eyebrow">{run.mode === 'duo' ? 'TAKEOVER DUO' : 'TAKEOVER'} · {run.taken.length}/{cities.length} CITIES</span>
            <h1 className="ag-h1">The road</h1>
          </div>
          <button className="ag-round-btn" onClick={onExit} aria-label="Back"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body">
          <div className="tk-status ag-pop">
            <span className="tk-lives">{Array.from({ length: LIVES }, (_, i) => <IconFlame key={i} size={18} style={{ opacity: i < run.lives ? 1 : .18 }} />)}</span>
            <span className="tk-ovr"><b>{ovr}</b> OVR</span>
            <button className="ag-chip" onClick={() => setScreen('build')}>MY BUILD</button>
            {run.mode !== 'duo' && <button className="ag-chip" onClick={() => setScreen('duo')}>DUO</button>}
            {run.mode === 'duo' && <button className={`ag-chip${duo.partner ? ' is-on' : ''}`} onClick={() => setChatOpen(true)}><IconChat size={13} /> {duo.partner ? duo.partner.name : 'WAITING'}</button>}
          </div>
          {nextCity && (
            <button className="tk-next ag-pop" style={{ '--tc': nextCity.color, '--d': '60ms' }} onClick={() => setScreen('city')}>
              <img src={nextCity.logo} alt="" className="tk-next-logo" />
              <span className="tk-next-txt">
                <span className="ag-eyebrow">NEXT STOP · #{nextCity.idx + 1}{nextCity.tier > 0 ? ` · TIER ${nextCity.tier + 1}` : ''}</span>
                <span className="tk-next-city">{nextCity.city}</span>
                <span className="tk-next-sub">{star ? `vs ${star.player.name}` : nextCity.nick}</span>
              </span>
              <span className="ag-edge-go">GO <IconArrow size={14} /></span>
            </button>
          )}
          <div className="tk-route ag-pop" style={{ '--d': '120ms' }}>
            {cities.map(c => {
              const state = taken.has(c.short) ? 'taken' : c.idx === run.idx ? 'next' : 'locked'
              return (
                <div key={c.short} className={`tk-stop is-${state}`} style={{ '--tc': c.color }}>
                  <img src={c.logo} alt="" loading="lazy" />
                  <span className="tk-stop-n">{c.idx + 1}</span>
                  {state === 'taken' && <span className="tk-stop-tick"><IconCheck size={10} /></span>}
                  {state === 'locked' && <span className="tk-stop-lock"><IconLock size={10} /></span>}
                </div>
              )
            })}
          </div>
          <div className="tk-log ag-pop" style={{ '--d': '160ms' }}>
            {run.log.slice(-6).reverse().map((l, i) => { const c = cities.find(x => x.short === l.city); return <div key={i} className={`tk-log-line${l.won ? ' is-w' : ' is-l'}`}><b>{l.won ? 'W' : 'L'}</b> {c?.city ?? l.city}</div> })}
          </div>
          <button className="ag-btn ag-btn--ghost tk-quit" onClick={() => { if (confirm('End this run? Your road and your build are gone.')) { clearRun(sport, run.uid); setRun(null); onExit() } }}>END RUN</button>
        </div>
        {chatOpen && <BlacktopChat bt={duo.chatApi} user={user} onClose={() => setChatOpen(false)} mode="takeover" title="DUO CHAT" />}
      </div>
    )
  }

  if (screen === 'build') {
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head"><div><span className="ag-eyebrow">{ovr} OVR</span><h1 className="ag-h1">My build</h1></div><button className="ag-round-btn" onClick={() => setScreen('map')} aria-label="Back"><IconClose size={16} /></button></div>
        <div className="ag-screen-body"><BuildRows build={run.build} types={run.types} attrMap={attrMap} /></div>
      </div>
    )
  }

  // ── City matchup ────────────────────────────────────────────────────────────
  if (screen === 'city' && city && star) {
    const sName = star.player.name
    return (
      <div className={`ag-screen ag-screen--${sport} tk tk-city`} style={{ '--tc': city.color, '--tc2': city.color2 }}>
        <div className="tk-city-hero">
          <img src={city.logo} alt="" className="tk-city-logo" />
          <span className="ag-eyebrow">STOP #{city.idx + 1} · {city.nick.toUpperCase()}</span>
          <h1 className="ag-h1 tk-city-name">{city.city}</h1>
          <button className="ag-round-btn tk-city-x" onClick={() => setScreen('map')} aria-label="Back"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body">
          <div className="tk-matchup ag-pop">
            <div className="tk-side">
              <span className="tk-side-av"><IconProfile size={26} /></span>
              <b>{me.name}</b><small>{ovr} OVR</small>
            </div>
            <span className="tk-vs">{isBucket ? (run.mode === 'duo' ? '2v2' : '1v1') : 'GAME'}</span>
            <div className="tk-side">
              <span className="tk-side-av">{star.build[run.types[0]]?.photo ? <img src={star.build[run.types[0]].photo} alt="" /> : sName.slice(0, 1)}</span>
              <b>{sName}</b><small>{star.boost ? `+${star.boost} road form` : city.nick}</small>
            </div>
          </div>
          <div className="tk-stakes ag-pop" style={{ '--d': '80ms' }}>
            <span className="ag-eyebrow">ON THE LINE</span>
            <p>{isBucket ? (run.mode === 'duo' ? 'You and your partner vs the city\'s two best, first to 15.' : 'First to 11, 1s and 2s, make it take it.') : `One game in ${city.city}. Your build vs their defense.`} Win: <b>upgrade a trait</b> or <b>steal one of {sName.split(' ').slice(-1)[0]}'s</b>. Lose: a life.</p>
            <div className="tk-star-grid">
              {run.types.map(t => { const v = star.build[t]?.val ?? 0, m = run.build[t]?.val ?? 0; return (
                <span key={t} className={`tk-star-cell${v > m ? ' is-up' : v < m ? ' is-down' : ''}`} style={{ '--g': gradeColor(v) }}>
                  <small>{attrMap[t]?.shortLabel ?? t.slice(0, 3).toUpperCase()}</small><b>{valToGrade(v)}</b>
                </span>
              ) })}
            </div>
          </div>
          {run.mode === 'duo' && !duo.partnerPlayer && <div className="ag-board-empty">Waiting for your partner to join…</div>}
          <button className="ag-btn tk-play ag-pop" style={{ '--d': '140ms' }} onClick={startDuel} disabled={run.mode === 'duo' && !duo.partnerPlayer}>{isBucket ? 'CHECK BALL' : 'KICKOFF'} <IconArrow size={18} /></button>
        </div>
      </div>
    )
  }

  if (screen === 'duel' && duel) {
    return duel.kind === 'hoops'
      ? <HoopsDuel duel={duel} run={run} city={duel.city} me={me} photoFor={photoFor} onDone={settle} />
      : <FootballDuel duel={duel} run={run} city={duel.city} onDone={settle} />
  }

  if (screen === 'reward' && duel?.star) {
    const beaten = duel.star, at = duel.city
    const ups = upgradeOptions(run), steals = stealOptions(run, beaten)
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head"><div><span className="ag-eyebrow">{at.city.toUpperCase()} TAKEN · +{XP_CITY} XP</span><h1 className="ag-h1">Take your prize</h1></div></div>
        <div className="ag-screen-body">
          <section className="ag-card ag-pop"><div className="ag-eyebrow">STEAL FROM {beaten.player.name.toUpperCase()}</div>
            <p className="tk-reward-sub">Take one of their traits where they beat you — their player goes in your build.</p>
            {steals.length === 0 && <div className="ag-board-empty">Nothing to steal — your build already beats theirs everywhere.</div>}
            <div className="tk-reward-grid">{steals.map(o => <button key={o.type} className="tk-reward-opt is-steal" style={{ '--g': gradeColor(o.to) }} onClick={() => reward('steal', o.type)}><small>{attrMap[o.type]?.label ?? o.type}</small><b>{valToGrade(o.from)} → {valToGrade(o.to)}</b></button>)}</div>
          </section>
          <section className="ag-card ag-pop" style={{ '--d': '80ms' }}><div className="ag-eyebrow">UPGRADE A TRAIT · +1</div>
            <div className="tk-reward-grid">{ups.map(o => <button key={o.type} className="tk-reward-opt" style={{ '--g': gradeColor(o.to) }} onClick={() => reward('upgrade', o.type)}><small>{attrMap[o.type]?.label ?? o.type}</small><b>{valToGrade(o.from)} → {valToGrade(o.to)}</b></button>)}</div>
          </section>
        </div>
      </div>
    )
  }

  if (screen === 'over') {
    const all = run.won
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-body">
          <div className={`bt-result-hero ${all ? 'is-win' : 'is-loss'} ag-pop`}>
            <span className="ag-eyebrow">{all ? 'TAKEOVER COMPLETE' : 'RUN OVER'}</span>
            <h1 className="ag-h1">{all ? `All ${cities.length} cities are yours` : `${run.taken.length} of ${cities.length} cities taken`}</h1>
            <div className="tk-over-ovr"><b>{ovr}</b> FINAL OVR</div>
          </div>
          <div className="tk-route ag-pop" style={{ '--d': '100ms' }}>
            {cities.map(c => <div key={c.short} className={`tk-stop is-${taken.has(c.short) ? 'taken' : 'locked'}`} style={{ '--tc': c.color }}><img src={c.logo} alt="" /><span className="tk-stop-n">{c.idx + 1}</span></div>)}
          </div>
          <button className="ag-btn ag-pop" style={{ '--d': '160ms' }} onClick={() => { clearRun(sport, run.uid); setRun(null); onNewBuild() }}>NEW BUILD · HIT THE ROAD AGAIN</button>
          <button className="ag-btn ag-btn--ghost" onClick={() => { clearRun(sport, run.uid); setRun(null); onExit() }}>HOME</button>
        </div>
      </div>
    )
  }

  if (screen === 'duo') {
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head"><div><span className="ag-eyebrow">TWO BUILDS · ONE ROAD</span><h1 className="ag-h1">Duo</h1></div><button className="ag-round-btn" onClick={() => setScreen('map')} aria-label="Back"><IconClose size={16} /></button></div>
        <div className="ag-screen-body">
          <p className="tk-reward-sub">Share a code. Your partner needs their own Takeover build on their phone. {isBucket ? 'Each city becomes a 2v2 vs its two best.' : 'You both play each city; it falls if either of you wins.'} Lives are shared.</p>
          <button className="ag-btn" onClick={() => { const code = genCode(); setRun(r => ({ ...r, mode: 'duo', code, host: true })); setScreen('map') }}>HOST · GET A CODE</button>
          <JoinCode onJoin={code => { setRun(r => ({ ...r, mode: 'duo', code, host: false })); setScreen('map') }} />
        </div>
      </div>
    )
  }
  return null
}

function JoinCode({ onJoin }) {
  const [code, setCode] = useState('')
  return (
    <form className="bt-chat-form" onSubmit={e => { e.preventDefault(); if (code.length >= 4) onJoin(code.toUpperCase()) }}>
      <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={8} placeholder="PARTNER'S CODE" />
      <button className="ag-btn ag-btn--ghost" type="submit" disabled={code.length < 4}>JOIN</button>
    </form>
  )
}

function BuildRows({ build, types, attrMap }) {
  return (
    <div className="tk-build">
      {types.map(t => { const c = build[t]; return (
        <div key={t} className={`tk-build-row${c?.stolen ? ' is-stolen' : ''}`}>
          <span className="tk-build-av">{c?.photo ? <img src={c.photo} alt="" /> : null}</span>
          <span className="tk-build-txt"><b>{attrMap[t]?.label ?? t}</b><small>{c?.qbFull ?? '—'}{c?.stolen ? ' · STOLEN' : ''}{c?.upgraded ? ` · +${c.upgraded}` : ''}</small></span>
          <span className="tk-build-g" style={{ background: gradeColor(c?.val ?? 0) }}>{valToGrade(c?.val ?? 0)}</span>
        </div>
      ) })}
    </div>
  )
}

// ── Duel playback: hoops ────────────────────────────────────────────────────
function HoopsDuel({ duel, run, city, me, photoFor, onDone }) {
  const [idx, setIdx] = useState(0)
  const [speed, setSpeed] = useState(1)
  const plays = duel.plays
  const play = plays[idx]
  const done = useRef(false)
  useEffect(() => {
    if (idx >= plays.length - 1) {
      if (!done.current) { done.current = true; setTimeout(() => { if (duel.win) { sfx('award'); confetti(120) } else sfx('pop'); onDone(duel.win) }, 2000) }
      return
    }
    const t = setTimeout(() => setIdx(i => i + 1), playDelay(play, idx === 0) / speed)
    return () => clearTimeout(t)
  }, [idx, speed]) // eslint-disable-line
  useEffect(() => { if (play?.type === 'score') sfx(play.pts === 2 ? 'lock' : 'tap') }, [idx]) // eslint-disable-line
  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).filter(p => p.type !== 'check').slice(-4).reverse()
  const goal = run.mode === 'duo' ? 15 : 11
  return (
    <div className="ag-screen ag-screen--bucket bt-game bt-live tk-duel" style={{ '--tc': city.color }}>
      <div className="bt-board">
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name">YOU</span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">{city.nick.toUpperCase()} · TO {goal}</span><button className={`ag-chip${speed === 2 ? ' is-on' : ''}`} onClick={() => setSpeed(s => (s === 1 ? 2 : 1))}>{speed}×</button></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`}><span className="bt-board-name">{duel.sides[1][0].name.split(' ').slice(-1)[0].toUpperCase()}</span><b>{score[1]}</b></div>
      </div>
      <div className="tk-duel-court">
        {duel.sides.map((side, t) => side.map(p => (
          <span key={p.id} className={`bt-chip bt-t${t}${play?.pid === p.id ? ' has-ball' : ''}${(play?.type === 'block' || play?.type === 'steal') && play.pid === p.id ? ' is-act' : ''}`} style={{ left: `${t === 0 ? 30 + p.slot * 14 : 70 - p.slot * 14}%`, top: `${t === 0 ? 68 : 40}%` }}>
            <span className="bt-chip-av">{p.id === 'me' || p.id === 'partner' ? <IconProfile size={18} /> : (p.build?.[run.types[0]]?.photo ? <img src={p.build[run.types[0]].photo} alt="" /> : p.name.slice(0, 1))}</span>
            <span className="bt-chip-name">{p.id === 'me' ? 'YOU' : p.name.split(' ').slice(-1)[0]}</span>
          </span>
        )))}
        {play?.type === 'score' && <span key={play.id} className={`bt-rim-flash${play.pts === 2 ? ' is-two' : ''}`}>{play.pts === 2 ? '+2' : '+1'}</span>}
      </div>
      <div className="bt-feed">{feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.big ? ' is-big' : ''}`}>{p.text.replace(me.name, 'You').replace(/^You /, 'You ')}</div>)}</div>
    </div>
  )
}

// ── Duel playback: football ────────────────────────────────────────────────
function FootballDuel({ duel, run, city, onDone }) {
  const [idx, setIdx] = useState(0)
  const plays = duel.plays
  const play = plays[idx]
  const done = useRef(false)
  useEffect(() => {
    if (idx >= plays.length - 1) {
      if (!done.current) { done.current = true; setTimeout(() => { if (duel.win) { sfx('award'); confetti(120) } else sfx('pop'); onDone(duel.win) }, 2200) }
      return
    }
    const t = setTimeout(() => setIdx(i => i + 1), play?.kind === 'td' ? 1700 : 1250)
    return () => clearTimeout(t)
  }, [idx]) // eslint-disable-line
  useEffect(() => { if (play?.kind === 'td') sfx(play.team === 0 ? 'lock' : 'pop'); else if (play?.kind === 'to') sfx('pop') }, [idx]) // eslint-disable-line
  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).slice(-5).reverse()
  return (
    <div className="ag-screen ag-screen--nfl bt-game bt-live tk-duel tk-duel--nfl" style={{ '--tc': city.color }}>
      <div className="bt-board">
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name">YOU</span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">{play?.q ?? 'Q1'}</span><span className="tk-duel-at">@ {city.city.toUpperCase()}</span></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`}><span className="bt-board-name">{city.short}</span><b>{score[1]}</b></div>
      </div>
      <div className="tk-field">
        <div className="tk-field-lines" />
        <img src={city.logo} alt="" className="tk-field-logo" />
        {play && <span key={play.id} className={`tk-drive tk-drive--${play.kind} bt-t${play.team}`}>{play.kind === 'td' ? 'TOUCHDOWN' : play.kind === 'fg' ? 'FIELD GOAL' : play.kind === 'to' ? 'TURNOVER' : play.kind === 'final' ? 'FINAL' : 'PUNT'}</span>}
      </div>
      <div className="bt-feed">{feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.kind === 'td' || p.kind === 'final' ? ' is-big' : ''}`}><small>{p.q}</small> {p.text}</div>)}</div>
      {idx >= plays.length - 1 && (
        <div className="tk-line ag-pop">
          {duel.line.keys.map((k, i) => <span key={k}><b>{duel.line.vals[i]}</b><small>{k}</small></span>)}
          {duel.partner && <span className="tk-line-partner">{duel.partner.win ? 'Partner: W' : 'Partner: L'}</span>}
        </div>
      )}
    </div>
  )
}

// ── Duo room ─────────────────────────────────────────────────────────────────
// The host's run is the road. The partner mirrors idx/lives/taken from it, and
// both keep their own builds and rewards. Builds are exchanged on join so the
// 2v2 (or the two football games) can be simulated identically on both phones.
function useDuo({ enabled, run, setRun, me, user, cities, pools, photoFor, isBucket, calcOvr, onCity }) {
  const roomRef = useRef(null)
  const [partner, setPartner] = useState(null)        // presence
  const [partnerPlayer, setPartnerPlayer] = useState(null)
  const [chat, setChat] = useState([])
  const lastChat = useRef(0)
  const code = run?.code
  const host = !!run?.host
  const runRef = useRef(run); runRef.current = run
  useEffect(() => {
    if (!enabled || !code) { roomRef.current?.leave(); roomRef.current = null; setPartner(null); setPartnerPlayer(null); return }
    const room = joinRoom(`takeover-${code}`, { ...me, pos: run.pos, host })
    roomRef.current = room
    const shareBuild = () => room.send('build', { pos: runRef.current.pos, types: runRef.current.types, build: runRef.current.build, name: me.name, ovr: calcOvr(runRef.current.build) })
    room.onPresence(list => {
      const other = list.find(p => p.vid !== me.vid)
      setPartner(other ?? null)
      if (other) shareBuild()
      if (other && host) room.send('state', { idx: runRef.current.idx, taken: runRef.current.taken, lives: runRef.current.lives, seed: runRef.current.seed, attempt: runRef.current.attempt, log: runRef.current.log })
    })
    room.on('build', p => setPartnerPlayer({ id: 'partner', name: p.name, pos: p.pos, types: p.types, build: p.build, ovr: p.ovr }))
    room.on('state', p => { if (!host) setRun(r => (r ? { ...r, idx: p.idx, taken: p.taken, lives: p.lives, seed: p.seed, attempt: p.attempt, log: p.log, over: p.lives <= 0 || p.idx >= cities.length, won: p.idx >= cities.length } : r)) })
    room.on('go', () => { if (!host) onCity() })
    room.on('chat', p => { if (!blockedIds().has(p.uid)) setChat(c => [...c.slice(-80), { id: `${p.from}-${p.ts}`, from: p.from, uid: p.uid, name: p.name, team: 0, text: clean(p.text), ts: p.ts, all: true }]) })
    return () => { room.leave(); roomRef.current = null }
  }, [enabled, code]) // eslint-disable-line
  // whenever my build changes (a reward), share it again
  useEffect(() => { if (roomRef.current && run) roomRef.current.send('build', { pos: run.pos, types: run.types, build: run.build, name: me.name, ovr: calcOvr(run.build) }) }, [run?.build]) // eslint-disable-line
  const sync = next => { if (host) roomRef.current?.send('state', { idx: next.idx, taken: next.taken, lives: next.lives, seed: next.seed, attempt: next.attempt, log: next.log }) }
  const sendChat = (text) => {
    const now = Date.now()
    if (!roomRef.current || !user || now - lastChat.current < MIN_GAP_MS) return false
    const t = clean(text); if (!t) return false
    lastChat.current = now
    const msg = { uid: me.uid, name: me.name, team: 0, text: t, ts: now, all: true }
    roomRef.current.send('chat', msg)
    setChat(c => [...c.slice(-80), { id: `${me.vid}-${now}`, from: me.vid, ...msg }])
    return true
  }
  return { partner, partnerPlayer, chat, sync, chatApi: { chat, sendChat, me, match: { code } } }
}
