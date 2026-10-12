import { useEffect, useMemo, useRef, useState } from 'react'
import { LIVES, XP_CITY, XP_RUN, XP_ENDLESS, cityList, ratedPool, ensureStop, stopAt, isEndless, whereAmI, opponentOf, nextBestOf, saveRun, clearRun, hoopsDuel, footballDuel, prizeOptions, applyReward, afterDuel, pastRuns, logRun, STOPS, COINS_CITY, COINS_RUN, HEAT_MAX, PLAN_CUT, CASH_MULT, heatOf, onFire, firing, planFor, duelBuild } from '../../lib/takeover'
import { W, H, OUTLINE_PATH, miles, heading } from '../../lib/usMap'
import { playDelay } from '../../lib/hoops'
import { joinRoom, genCode, myVid } from '../../lib/live'
import { clean, blockedIds, MIN_GAP_MS } from '../../lib/chat'
import { valToGrade } from '../../utils/simulation'
import { useProgress, myCosmetics } from '../../lib/progress'
import { NameTag, AvatarBadge } from './NameTag'
import { getUsername } from '../../lib/discord'
import { sfx, haptic, victory } from '../../lib/juice'
import { BlacktopChat } from './AppBlacktop'
import BlacktopCourt from './BlacktopCourt'
import Silhouette from '../Silhouette'
import { IconClose, IconArrow, IconCheck, IconFlame, IconChat, IconStar, IconProfile, IconTrophy } from './icons'

// TAKEOVER — the road across the map. The run (lib/takeover.js) is plain data
// saved on the device; this screen walks it: the map → the city's player → the
// duel → the reward → the next city, and on past the twelfth. Duo: two runs
// share one road over a live room.

const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }   // rounded like the letter (valToGrade)
const POS_LABEL = { guard: 'GUARD', big: 'BIG', qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', db: 'DB' }
// team colours can be near-black: lift them so rings and names read on the court
function lift(hex, amt = .35) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#ff8a3d'
  const n = parseInt(m[1], 16)
  const ch = s => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amt).toString(16).padStart(2, '0')
  return `#${ch(16)}${ch(8)}${ch(0)}`
}
const Headshot = ({ src, name, size = 44, className = '' }) => (
  <span className={`tk-hs ${className}`} style={{ width: size, height: size }}>{src ? <img src={src} alt="" /> : (name || '?').slice(0, 1)}</span>
)
const lastName = n => (n || '').split(' ').slice(-1)[0]

export default function AppTakeover({ sport, run, setRun, user, pools, attrMap, photoFor, calcOvr, teams, onNewBuild, onExit }) {
  const isBucket = sport === 'bucket'
  const cities = useMemo(() => cityList(sport, teams), [sport, teams])
  const byShort = useMemo(() => Object.fromEntries(cities.map(c => [c.short, c])), [cities])
  const pool = pools[run?.pos] ?? pools.guard ?? []
  const rated = useMemo(() => (run ? ratedPool(pool, run.types, calcOvr, cities) : []), [pool, run?.types, run?.pos, cities]) // eslint-disable-line
  const [screen, setScreen] = useState(() => (run?.over ? 'over' : run?.justWon ? 'complete' : 'map'))
  const [stealPick, setStealPick] = useState([])     // ON FIRE: the two ratings being stolen
  const [duel, setDuel] = useState(null)            // { ...result, city, star, stop } — the stop it was played at
  const [chatOpen, setChatOpen] = useState(false)
  const me = useMemo(() => ({ vid: myVid(), name: user ? (getUsername(user) || 'Player') : 'Guest', uid: user?.id ?? null, cos: myCosmetics() }), [user?.id]) // eslint-disable-line
  useEffect(() => { if (run) saveRun(run) }, [run])
  // endless: the next stop is drawn when you get there
  useEffect(() => { if (run && !run.over && !stopAt(run) && rated.length) setRun(r => (r ? ensureStop(r, rated) : r)) }, [run?.idx, run?.endless?.length, rated.length]) // eslint-disable-line

  const stop = run && !run.over ? stopAt(run) : null
  const city = stop ? byShort[stop.short] ?? null : null
  const planned = !!run && planFor(run)
  const star = useMemo(() => (stop && city ? opponentOf(stop, city, pool, run.types, photoFor, planned) : null), [stop, city, pool, run?.types, photoFor, planned])
  const here = run ? byShort[whereAmI(run)] ?? null : null
  const endless = !!run && isEndless(run)

  // ── Duo (two runs, one road) ────────────────────────────────────────────────
  const duo = useDuo({ enabled: !!run && run.mode === 'duo', run, setRun, me, user, calcOvr, onCity: () => setScreen('city') })
  const partnerStar = run?.mode === 'duo' && duo.partnerPlayer && city && star ? nextBestOf(city, pools[duo.partnerPlayer.pos] ?? pool, duo.partnerPlayer.types, photoFor, star.player.name) : null

  const startDuel = () => {
    if (!run || !city || !star) return
    let d
    if (isBucket) {
      const partner = run.mode === 'duo' ? duo.partnerPlayer : null
      d = { kind: 'hoops', ...hoopsDuel({ run, city, star, me: { name: me.name }, partner, partnerStar: partner ? partnerStar : null }) }
      d.win = d.winner === 0
    } else {
      const ovr = calcOvr(duelBuild(run))
      d = { kind: 'football', ...footballDuel({ run, city, star, myOvr: ovr, myTeamShort: me.name.toUpperCase() }) }
      if (run.mode === 'duo' && duo.partnerPlayer) {
        const pd = footballDuel({ run: { ...run, seed: run.seed + 'p' }, city, star, myOvr: duo.partnerPlayer.ovr ?? ovr })
        d.partner = pd
        d.win = d.win || pd.win         // the city falls if either of you wins
      }
    }
    setDuel({ ...d, city, star, stop }); setScreen('duel'); sfx('whistle'); haptic('medium')
  }
  const settle = won => {
    const at = duel?.city ?? city
    const wasEndless = isEndless(run)
    const next = afterDuel(run, at, won)
    if (won) {
      window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp: wasEndless ? XP_ENDLESS : XP_CITY, coins: COINS_CITY, label: wasEndless ? `Endless · ${next.endlessWins} straight` : `${at.city} taken` } }))
      window.dispatchEvent(new CustomEvent('bap:takeover', { detail: { city: true } }))
      if (next.justWon) { window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp: XP_RUN, coins: COINS_RUN, label: 'TAKEOVER complete' } })); window.dispatchEvent(new CustomEvent('bap:takeover', { detail: { run: true } })) }
    }
    setRun(next.over ? logRun(next, calcOvr(next.build)) : next)
    if (run.mode === 'duo') duo.sync(next)
    setScreen(won ? 'reward' : next.over ? 'over' : 'map')
  }
  const reward = (kind, type) => {
    const next = applyReward(run, { kind, type }, duel?.star ?? star)
    if (kind === 'cash') window.dispatchEvent(new CustomEvent('bap:xp', { detail: { xp: 0, coins: COINS_CITY * CASH_MULT, label: `Cashed in ${duel?.city?.city ?? ''}` } }))
    setRun(next); sfx('claim'); haptic('success')
    if (run.mode === 'duo') duo.sync(next)
    setScreen(next.justWon ? 'complete' : 'map')
  }
  const leaveComplete = () => { setRun(r => (r ? { ...r, justWon: false } : r)); setScreen('map') }

  if (!run) return null
  const ovr = calcOvr(run.build)
  const total = run.route.length

  // ── Map ─────────────────────────────────────────────────────────────────────
  if (screen === 'map') {
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head">
          <div>
            <span className="ag-eyebrow">{run.mode === 'duo' ? 'TAKEOVER DUO' : 'TAKEOVER'} · {endless ? `ENDLESS · ${run.endlessWins} STRAIGHT` : `STOP ${Math.min(run.idx + 1, total)} OF ${total}`}</span>
            <h1 className="ag-h1">{endless ? 'The road goes on' : 'The road'}</h1>
          </div>
          <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body">
          <div className="tk-status ag-pop">
            <span className="tk-lives">{Array.from({ length: LIVES }, (_, i) => <IconFlame key={i} size={18} style={{ opacity: i < run.lives ? 1 : .18 }} />)}</span>
            <span className="tk-ovr"><b>{ovr}</b> OVR</span>
            <span className={`tk-heat${firing(run) ? ' is-fire' : ''}`} title="Wins in a row. Three and you're on fire.">{firing(run) ? 'ON FIRE' : 'HEAT'} {Array.from({ length: HEAT_MAX }, (_, i) => <i key={i} className={firing(run) || i < heatOf(run) ? 'is-on' : ''} />)}</span>
            <button className="ag-chip" onClick={() => setScreen('build')}><IconProfile size={13} /> MY BUILD</button>
            {run.mode !== 'duo' && <button className="ag-chip" onClick={() => setScreen('duo')}>DUO</button>}
            {run.mode === 'duo' && <button className={`ag-chip${duo.partner ? ' is-on' : ''}`} onClick={() => setChatOpen(true)}><IconChat size={13} /> {duo.partner ? <NameTag name={duo.partner.name} cos={duo.partner.cos} plate={false} /> : 'WAITING'}</button>}
          </div>
          {/* duo, waiting on a partner: the code to share, big */}
          {run.mode === 'duo' && run.code && !duo.partner && <DuoCode code={run.code} host={run.host} />}
          <UsMap cities={cities} run={run} here={here} next={city} />
          {city && star && stop ? (
            <button className="tk-next ag-pop" style={{ '--tc': city.color, '--d': '80ms' }} onClick={() => setScreen('city')}>
              <Headshot src={star.build[run.types[0]]?.photo} name={star.player.name} size={56} className="tk-next-hs" />
              <span className="tk-next-txt">
                <span className="ag-eyebrow">{endless ? 'NEXT · ANYWHERE' : `NEXT STOP · #${run.idx + 1}`}{here && here.short !== city.short ? ` · ${miles(here, city).toLocaleString()} MI ${heading(here, city)}` : ''}</span>
                <span className="tk-next-city">{city.city}</span>
                <span className="tk-next-sub">vs <b>{star.player.name}</b> · {stop.ovr} OVR{star.boost ? ` · +${star.boost} form` : ''}</span>
              </span>
              <span className="ag-edge-go">GO <IconArrow size={14} /></span>
            </button>
          ) : (
            <div className="ag-board-empty">Drawing your next opponent…</div>
          )}
          <div className="tk-log ag-pop" style={{ '--d': '140ms' }}>
            {run.log.slice(-8).reverse().map((l, i) => { const c = byShort[l.city]; return <div key={i} className={`tk-log-line${l.won ? ' is-w' : ' is-l'}`}><b>{l.won ? 'W' : 'L'}</b> {c?.city ?? l.city}</div> })}
          </div>
          <button className="ag-btn ag-btn--ghost tk-quit" onClick={() => { if (confirm('End this run? Your road and your build are gone.')) { logRun(run, ovr); clearRun(sport, run.uid); setRun(null); onExit() } }}>END RUN</button>
        </div>
        {chatOpen && <BlacktopChat bt={duo.chatApi} user={user} onClose={() => setChatOpen(false)} mode="takeover" title="DUO CHAT" />}
      </div>
    )
  }

  // ── My build: the player model, then where every trait came from ──────────
  if (screen === 'build') {
    const wins = run.log.filter(l => l.won).length, losses = run.log.length - wins
    const stolen = run.types.filter(t => run.build[t]?.stolen).length
    const ups = run.types.reduce((s, t) => s + (run.build[t]?.upgraded ?? 0), 0)
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head"><div><span className="ag-eyebrow">{POS_LABEL[run.pos] ?? run.pos.toUpperCase()} · {run.mode === 'duo' ? 'DUO' : 'SOLO'} ROAD</span><h1 className="ag-h1">My build</h1></div><button className="ag-round-btn" onClick={() => setScreen('map')} aria-label="Back"><IconClose size={16} /></button></div>
        <div className="ag-screen-body">
          <div className="tk-model-card ag-pop">
            <div className={`tk-model${isBucket ? ' tk-model--nba' : ''}`}>
              <Silhouette build={run.build} types={run.types} attrMap={attrMap} isBucket={isBucket} isRB={run.pos === 'rb'} isWR={run.pos === 'wr'} isTE={run.pos === 'te'} isDB={run.pos === 'db'} modelOnly />
            </div>
            <div className="tk-model-side">
              <span className="tk-model-ovr"><b>{ovr}</b><small>OVR</small></span>
              <span className="tk-model-stat"><b>{run.taken.length}</b> {run.taken.length === 1 ? 'city' : 'cities'} taken</span>
              <span className="tk-model-stat"><b>{wins}–{losses}</b> on the road</span>
              <span className="tk-model-stat"><b>{stolen}</b> stolen · <b>{ups}</b> upgrades</span>
              {endless && <span className="tk-model-stat tk-model-stat--hot"><b>{run.endlessWins}</b> endless {run.endlessWins === 1 ? 'win' : 'wins'}</span>}
            </div>
          </div>
          <BuildRows build={run.build} types={run.types} attrMap={attrMap} />
        </div>
      </div>
    )
  }

  // ── City matchup ────────────────────────────────────────────────────────────
  if (screen === 'city' && city && star && stop) {
    const sName = star.player.name
    return (
      <div className={`ag-screen ag-screen--${sport} tk tk-city`} style={{ '--tc': city.color, '--tc2': city.color2 }}>
        <div className="tk-city-hero">
          <img src={city.logo} alt="" className="tk-city-logo" />
          <span className="ag-eyebrow">{endless ? 'ENDLESS' : `STOP #${run.idx + 1}`} · {city.nick.toUpperCase()}</span>
          <h1 className="ag-h1 tk-city-name">{city.city}</h1>
          <button className="ag-round-btn tk-city-x" onClick={() => setScreen('map')} aria-label="Back"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body">
          <div className="tk-matchup ag-pop">
            <div className="tk-side">
              <span className="tk-side-av"><AvatarBadge self name={me.name} size={40} /></span>
              <b><NameTag name={me.name} self plate={false} /></b><small>{ovr} OVR</small>
            </div>
            <span className="tk-vs">{isBucket ? (run.mode === 'duo' ? '2v2' : '1v1') : 'GAME'}</span>
            <div className="tk-side">
              <Headshot src={star.build[run.types[0]]?.photo} name={sName} size={64} className="tk-side-hs" />
              <b>{sName}</b><small>{stop.ovr} OVR{star.boost ? ` · +${star.boost} form` : ''}</small>
            </div>
          </div>
          {run.mode === 'duo' && duo.partnerPlayer && partnerStar && (
            <div className="tk-duo-line ag-pop" style={{ '--d': '60ms' }}>
              <span><AvatarBadge name={duo.partnerPlayer.name} cos={duo.partner?.cos ?? duo.partnerPlayer.cos ?? null} size={22} /> <NameTag name={duo.partnerPlayer.name} cos={duo.partner?.cos ?? duo.partnerPlayer.cos ?? null} plate={false} /></span><i>vs</i><span><Headshot src={partnerStar.build[duo.partnerPlayer.types?.[0]]?.photo} name={partnerStar.player.name} size={22} /> {partnerStar.player.name}</span>
            </div>
          )}
          <div className="tk-stakes ag-pop" style={{ '--d': '80ms' }}>
            <span className="ag-eyebrow">ON THE LINE</span>
            <p>{isBucket ? (run.mode === 'duo' ? `You and your partner vs ${lastName(sName)} and the ${city.nick}' next best, first to 15.` : 'First to 11, 1s and 2s, make it take it.') : `One game in ${city.city}. Your build vs their defense.`} Win: <b>steal one of {lastName(sName)}'s ratings</b>, or take a game plan, a rest or the cash. Lose: a life, and your heat.</p>
            {(planned || firing(run)) && <div className="tk-edges">
              {planned && star.cut && <span className="tk-edge is-plan">GAME PLAN · their {(attrMap[star.cut]?.label ?? star.cut).toLowerCase()} −{PLAN_CUT} this game</span>}
              {firing(run) && <span className="tk-edge is-fire">ON FIRE · +1 to every rating you have, this game</span>}
            </div>}
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
      ? <HoopsDuel duel={duel} run={run} city={duel.city} me={me} onDone={settle} />
      : <FootballDuel duel={duel} run={run} city={duel.city} me={me} onDone={settle} />
  }

  if (screen === 'reward' && duel?.star) {
    const beaten = duel.star, at = duel.city
    const P = prizeOptions(run, beaten)
    const picked = stealPick.filter(t => P.steals.some(o => o.type === t))
    const tap = t => setStealPick(l => (l.includes(t) ? l.filter(x => x !== t) : P.take === 1 ? [t] : [...l, t].slice(-P.take)))
    const go = (kind, type) => { setStealPick([]); reward(kind, type) }
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-head"><div><span className="ag-eyebrow">{at.city.toUpperCase()} TAKEN · +{isEndless(run) && run.idx > total ? XP_ENDLESS : XP_CITY} XP{onFire(run) ? ' · ON FIRE' : ''}</span><h1 className="ag-h1">Take your prize</h1></div></div>
        <div className="ag-screen-body">
          <section className="ag-card ag-pop"><div className="ag-eyebrow">{P.take > 1 ? 'ON FIRE · STEAL TWO' : 'STEAL A RATING'} FROM {beaten.player.name.toUpperCase()}</div>
            <p className="tk-reward-sub">{P.take > 1 ? 'Three straight: pick two of their ratings where they beat you, and play the next game with +1 on everything. Then heat starts over.' : 'Take one of their ratings where they beat you. Their player goes in your build.'}</p>
            {P.steals.length === 0 && <div className="ag-board-empty">Nothing to steal. Your build already beats theirs everywhere.</div>}
            <div className="tk-reward-grid">{P.steals.map(o => <button key={o.type} className={`tk-reward-opt is-steal${picked.includes(o.type) ? ' is-on' : ''}`} style={{ '--g': gradeColor(o.to) }} onClick={() => (P.take === 1 ? go('steal', o.type) : tap(o.type))}><small>{attrMap[o.type]?.label ?? o.type}</small><b>{valToGrade(o.from)} → {valToGrade(o.to)}</b></button>)}</div>
            {P.take > 1 && P.steals.length > 0 && <button className="ag-btn ag-btn--gold tk-steal-go" disabled={picked.length < P.take} onClick={() => go('steal', picked)}>STEAL {picked.length}/{P.take} <IconArrow size={15} /></button>}
          </section>
          <div className="ag-eyebrow tk-or ag-pop" style={{ '--d': '60ms' }}>OR TAKE</div>
          <div className="tk-prizes ag-pop" style={{ '--d': '80ms' }}>
            <button className="tk-prize" onClick={() => go('plan')}><b>GAME PLAN</b><small>Film on the next city: their best rating −{PLAN_CUT} for that game.</small></button>
            {P.rest && <button className="tk-prize" onClick={() => go('rest')}><b>REST UP</b><small>A life back. {run.lives}/{LIVES} now.</small></button>}
            <button className="tk-prize" onClick={() => go('cash')}><b>CASH IN</b><small>+{COINS_CITY * CASH_MULT} coins instead of a rating.</small></button>
          </div>
        </div>
      </div>
    )
  }

  // ── The twelfth fell ─────────────────────────────────────────────────────
  if (screen === 'complete') {
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-body">
          <div className="bt-result-hero is-win ag-pop">
            <span className="ag-eyebrow">TAKEOVER COMPLETE · +{XP_RUN} XP</span>
            <h1 className="ag-h1">The map is yours</h1>
            <p className="tk-reward-sub" style={{ margin: '4px 0 0', textAlign: 'center' }}>Twelve cities, twelve better players, one build. From here the road goes endless: random greats, anywhere, with three fresh lives.</p>
            <div className="tk-over-ovr"><b>{ovr}</b> OVR</div>
          </div>
          <UsMap cities={cities} run={run} here={here} next={null} delay="120ms" />
          <button className="ag-btn ag-pop" style={{ '--d': '200ms' }} onClick={leaveComplete}>KEEP GOING · ENDLESS <IconArrow size={16} /></button>
          <button className="ag-btn ag-btn--ghost" onClick={() => { leaveComplete(); onExit() }}>HOME</button>
        </div>
      </div>
    )
  }

  if (screen === 'over') {
    return (
      <div className={`ag-screen ag-screen--${sport} tk`}>
        <div className="ag-screen-body">
          <div className={`bt-result-hero ${run.won ? 'is-win' : 'is-loss'} ag-pop`}>
            <span className="ag-eyebrow">{run.won ? 'ENDLESS ROAD OVER' : 'RUN OVER'}</span>
            <h1 className="ag-h1">{run.won ? `All ${total} cities, then ${run.endlessWins} more` : `${run.taken.length} of ${total} cities taken`}</h1>
            <div className="tk-over-ovr"><b>{ovr}</b> FINAL OVR</div>
          </div>
          <UsMap cities={cities} run={run} here={here} next={null} delay="100ms" />
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
          <p className="tk-reward-sub">Share a code. Your partner needs their own Takeover build on their phone. {isBucket ? 'Every stop becomes a 2v2: the city\'s player, plus their next best.' : 'You both play each city; it falls if either of you wins.'} The road and the lives are shared.</p>
          <button className="ag-btn" onClick={() => { const code = genCode(); setRun(r => ({ ...r, mode: 'duo', code, host: true })); setScreen('map') }}>HOST · GET A CODE</button>
          <JoinCode onJoin={code => { setRun(r => ({ ...r, mode: 'duo', code, host: false })); setScreen('map') }} />
        </div>
      </div>
    )
  }
  return null
}

// ── The map ──────────────────────────────────────────────────────────────────
// Dots for the country, a pin per league city. Taken cities carry their logo
// and the trail runs through them; the next stop pulses with its name.
function UsMap({ cities, run, here, next, delay = '40ms' }) {
  const byShort = Object.fromEntries(cities.map(c => [c.short, c]))
  const start = byShort[run.start]
  const trail = [start, ...run.taken.map(s => byShort[s])].filter(Boolean)
  const px = c => `${(c.x / 100 * W).toFixed(1)} ${(c.y / 100 * H).toFixed(1)}`
  const seg = here && next && here.short !== next.short ? `M${px(here)} L${px(next)}` : null
  return (
    <div className="tk-map ag-pop" style={{ '--d': delay, aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="tk-map-svg" aria-hidden="true">
        <defs>
          <clipPath id="tk-us"><path d={OUTLINE_PATH} clipRule="evenodd" /></clipPath>
          <pattern id="tk-dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.1" fill="currentColor" /></pattern>
          <radialGradient id="tk-here"><stop offset="0" style={{ stopColor: 'var(--ag-a1)', stopOpacity: .5 }} /><stop offset="1" style={{ stopColor: 'var(--ag-a1)', stopOpacity: 0 }} /></radialGradient>
        </defs>
        <g clipPath="url(#tk-us)">
          <rect width={W} height={H} fill="url(#tk-dots)" />
          {here && <circle cx={here.x / 100 * W} cy={here.y / 100 * H} r="140" fill="url(#tk-here)" />}
        </g>
        <path d={OUTLINE_PATH} className="tk-map-line" />
        {trail.length > 1 && <polyline points={trail.map(c => px(c).replace(' ', ',')).join(' ')} className="tk-map-trail" />}
        {seg && <path d={seg} className="tk-map-next" />}
      </svg>
      <div className="tk-pins">
        {cities.map(c => {
          const isTaken = run.taken.includes(c.short), isNext = next?.short === c.short, isHere = here?.short === c.short, isStart = run.start === c.short
          const nearNext = !!next && Math.hypot(next.x - c.x, next.y - c.y) < 9     // the START tag would sit under the next stop's
          return (
            <span key={c.short} className={`tk-pin${isTaken ? ' is-taken' : ''}${isNext ? ' is-next' : ''}${isHere ? ' is-here' : ''}${isStart && !isTaken ? ' is-start' : ''}`} style={{ left: `${c.x}%`, top: `${c.y}%`, '--tc': c.color }}>
              {(isTaken || isNext) && <img src={c.logo} alt="" draggable={false} />}
              {isNext && <i className={`tk-pin-label${c.y > 78 ? ' is-up' : ''}${c.x > 84 ? ' is-right' : c.x < 16 ? ' is-left' : ''}`}>{c.city.toUpperCase()}</i>}
              {isStart && !isTaken && !isNext && !nearNext && <i className={`tk-pin-label tk-pin-label--start${c.y > 78 ? ' is-up' : ''}${c.x > 84 ? ' is-right' : c.x < 16 ? ' is-left' : ''}`}>START</i>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// The duo code, waiting on the other player: big, with a copy / share button
function DuoCode({ code, host }) {
  const [done, setDone] = useState('')
  const share = async () => {
    const text = `Takeover duo on Build-A-Player. Join with code ${code}`
    try {
      if (navigator.share) { await navigator.share({ text }); return }
      await navigator.clipboard.writeText(code); setDone('COPIED'); setTimeout(() => setDone(''), 1800)
    } catch {}
  }
  return (
    <div className="tk-code ag-pop">
      <span className="ag-eyebrow">{host ? 'YOUR DUO CODE · SEND IT TO YOUR PARTNER' : 'JOINING · WAITING FOR YOUR PARTNER'}</span>
      <b className="tk-code-val">{code}</b>
      {host && <button className="ag-btn ag-btn--ghost tk-code-btn" onClick={share}>{done || 'SHARE CODE'}</button>}
      <small>{host ? 'They tap DUO, then enter it under JOIN.' : "Hang tight: the road starts when they're here."}</small>
    </div>
  )
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

// ── Duel playback: hoops, on the court ──────────────────────────────────────
function HoopsDuel({ duel, run, city, me, onDone }) {
  const [idx, setIdx] = useState(0)
  const [speed, setSpeed] = useState(1)
  const plays = duel.plays
  const play = plays[idx]
  const done = useRef(false)
  useEffect(() => {
    if (idx >= plays.length - 1) {
      if (!done.current) { done.current = true; setTimeout(() => { if (duel.win) victory(); else sfx('pop'); onDone(duel.win) }, 2200) }
      return
    }
    const t = setTimeout(() => setIdx(i => i + 1), playDelay(play, idx === 0) / speed)
    return () => clearTimeout(t)
  }, [idx, speed]) // eslint-disable-line
  useEffect(() => {
    // (a make is heard on the court itself: BlacktopCourt)
    if (play?.type === 'block' || play?.type === 'steal') setTimeout(() => sfx('pop'), 700)
  }, [idx]) // eslint-disable-line
  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).filter(p => p.type !== 'check').slice(-4).reverse()
  const duoGame = duel.sides[0].length > 1
  const goal = duoGame ? 15 : 11
  const opp = lift(city.color)
  const photoFor = p => p.build?.[run.types[0]]?.photo ?? null
  // my own avatar badge and name, and my partner's in theirs
  const avatarFor = p => (p.id === 'me' ? <AvatarBadge self name={me.name} size={40} /> : p.id === 'partner' ? <AvatarBadge name={p.name} cos={p.cos || null} size={40} /> : null)
  return (
    <div className="ag-screen ag-screen--bucket bt-game bt-live tk-duel" style={{ '--tc': city.color }}>
      <div className="bt-board">
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name"><NameTag name={me.name} self plate={false} />{duoGame ? ' +1' : ''}</span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">{city.city.toUpperCase()} · TO {goal}</span><button className={`ag-chip${speed === 2 ? ' is-on' : ''}`} onClick={() => setSpeed(s => (s === 1 ? 2 : 1))}>{speed}×</button></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`} style={{ '--tc': opp }}><span className="bt-board-name">{duoGame ? city.nick.toUpperCase() : lastName(duel.sides[1][0].name).toUpperCase()}</span><b>{score[1]}</b></div>
      </div>
      <BlacktopCourt game={duel} play={play} meId="me" meName={me.name} photoFor={photoFor} avatarFor={avatarFor} colorFor={t => (t === 0 ? '#e8f0f6' : opp)} speed={speed} />
      <div className="bt-feed">{feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.big ? ' is-big' : ''}${p.type === 'milestone' ? ' is-ms' : ''}`} style={p.team === 1 ? { '--tc': opp } : undefined}>{p.text}</div>)}</div>
    </div>
  )
}

// ── Duel playback: football ────────────────────────────────────────────────
// The drive on a field, like a TV broadcast: a 100-yard field with both end
// zones (yours on the left, the city's on the right), the drive drawn as an arc
// from where it started to where it ended, the ball at the end. You go left to
// right, they go right to left. Where a drive starts and stops is drawn from the
// result (a touchdown reaches the end zone, a punt stalls near midfield).
const RESULT = { td: 'TOUCHDOWN', fg: 'FIELD GOAL', to: 'TURNOVER', punt: 'PUNT', final: 'FINAL' }
const hashOf = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
function driveOf(play) {
  const r = n => hashOf(`${play.id}-${n}`)
  const start = Math.round(15 + r(1) * 20)                      // own 15 to 35
  const end = play.kind === 'td' ? 100 : play.kind === 'fg' ? Math.round(62 + r(2) * 18) : play.kind === 'to' ? Math.round(start + 8 + r(3) * 40) : Math.round(start + 6 + r(4) * 30)
  // yards from MY goal line (0) to theirs (100): their drives run the other way
  return play.team === 0 ? { from: start, to: end } : { from: 100 - start, to: 100 - end }
}
function FieldStrip({ play, plays, idx, city, opp, myName }) {
  const W = 360, H = 100, EZ = 26, X = y => EZ + (y / 100) * (W - 2 * EZ)       // yard → x
  const fieldY = 40, fieldH = 44
  const d = play && play.kind !== 'final' ? driveOf(play) : null
  const lastDrive = d ?? [...plays.slice(0, idx)].reverse().filter(p => p.kind !== 'final').map(driveOf)[0] ?? null
  const x1 = lastDrive ? X(lastDrive.from) : X(50), x2 = lastDrive ? X(lastDrive.to) : X(50)
  const lift = Math.min(34, 8 + Math.abs(x2 - x1) * 0.18)
  const arc = `M ${x1} ${fieldY + fieldH / 2} Q ${(x1 + x2) / 2} ${fieldY + fieldH / 2 - lift * 2} ${x2} ${fieldY + fieldH / 2}`
  const mine = play?.team === 0
  const label = play ? (RESULT[play.kind] ?? '') : 'KICKOFF'
  return (
    <div className="tk-fs ag-pop">
      <div className={`tk-fs-head${play?.kind === 'td' ? ' is-td' : ''}`} style={{ '--tc': mine ? 'var(--ag-a1)' : opp }}>
        {play && !mine && <img src={city.logo} alt="" />}<span key={play?.id ?? 'k'}>{label}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="tk-fs-svg" role="img" aria-label={`${label}${lastDrive ? `, from the ${Math.round(lastDrive.from)} to the ${Math.round(lastDrive.to)}` : ''}`}>
        <defs>
          <pattern id="tkfs-stripes" width={(W - 2 * EZ) / 10} height={fieldH} patternUnits="userSpaceOnUse" x={EZ}>
            <rect width={(W - 2 * EZ) / 20} height={fieldH} fill="#3f9a4a" /><rect x={(W - 2 * EZ) / 20} width={(W - 2 * EZ) / 20} height={fieldH} fill="#378c42" />
          </pattern>
        </defs>
        <rect x={EZ} y={fieldY} width={W - 2 * EZ} height={fieldH} fill="url(#tkfs-stripes)" />
        {/* the end zones: mine left, theirs right */}
        <rect x="0" y={fieldY} width={EZ} height={fieldH} className="tk-fs-ez-me" />
        <rect x={W - EZ} y={fieldY} width={EZ} height={fieldH} fill={opp} />
        <text x={EZ / 2} y={fieldY + fieldH / 2} className="tk-fs-ez-txt" transform={`rotate(-90 ${EZ / 2} ${fieldY + fieldH / 2})`}>{(myName || 'GUEST').slice(0, 8).toUpperCase()}</text>
        <text x={W - EZ / 2} y={fieldY + fieldH / 2} className="tk-fs-ez-txt" transform={`rotate(90 ${W - EZ / 2} ${fieldY + fieldH / 2})`}>{city.short}</text>
        {/* yard lines every 10, numbers under the field */}
        {Array.from({ length: 11 }, (_, i) => <line key={i} x1={X(i * 10)} x2={X(i * 10)} y1={fieldY} y2={fieldY + fieldH} className={`tk-fs-line${i === 0 || i === 10 ? ' is-goal' : ''}`} />)}
        {Array.from({ length: 9 }, (_, i) => <text key={i} x={X((i + 1) * 10)} y={fieldY + fieldH + 7} className="tk-fs-num">{(i + 1) * 10 <= 50 ? (i + 1) * 10 : 100 - (i + 1) * 10}</text>)}
        <image href={city.logo} x={X(50) - 9} y={fieldY + fieldH / 2 - 9} width="18" height="18" opacity=".55" />
        {/* the drive */}
        {lastDrive && (
          <g key={play?.id} className="tk-fs-drive">
            <line x1={x1} x2={x1} y1={fieldY} y2={fieldY + fieldH} className="tk-fs-los" />
            <path d={arc} className={`tk-fs-arc${mine ? ' is-me' : ''}`} style={mine ? undefined : { stroke: opp }} pathLength="1" />
            <circle cx={x2} cy={fieldY + fieldH / 2} r="4" className="tk-fs-ball" />
          </g>
        )}
      </svg>
    </div>
  )
}
function FootballDuel({ duel, run, city, me, onDone }) {
  const [idx, setIdx] = useState(0)
  const plays = duel.plays
  const play = plays[idx]
  const done = useRef(false)
  useEffect(() => {
    if (idx >= plays.length - 1) {
      if (!done.current) { done.current = true; setTimeout(() => { if (duel.win) victory(); else sfx('pop'); onDone(duel.win) }, 2200) }
      return
    }
    const t = setTimeout(() => setIdx(i => i + 1), play?.kind === 'td' ? 1700 : 1250)
    return () => clearTimeout(t)
  }, [idx]) // eslint-disable-line
  useEffect(() => { if (play?.kind === 'td') sfx(play.team === 0 ? 'lock' : 'pop'); else if (play?.kind === 'to') sfx('pop') }, [idx]) // eslint-disable-line
  const score = play?.score ?? [0, 0]
  const feed = plays.slice(0, idx + 1).slice(-5).reverse()
  const opp = lift(city.color)
  return (
    <div className="ag-screen ag-screen--nfl bt-game bt-live tk-duel tk-duel--nfl" style={{ '--tc': city.color }}>
      <div className="bt-board">
        <div className={`bt-board-side bt-t0${score[0] > score[1] ? ' is-lead' : ''}`}><span className="bt-board-name"><NameTag name={me.name} self plate={false} /></span><b>{score[0]}</b></div>
        <div className="bt-board-mid"><span className="ag-eyebrow">{play?.q ?? 'Q1'}</span><span className="tk-duel-at">@ {city.city.toUpperCase()}</span></div>
        <div className={`bt-board-side bt-t1${score[1] > score[0] ? ' is-lead' : ''}`} style={{ '--tc': opp }}><span className="bt-board-name">{city.short}</span><b>{score[1]}</b></div>
      </div>
      <FieldStrip play={play} plays={plays} idx={idx} city={city} opp={opp} myName={me.name} />
      <div className="bt-feed">{feed.map((p, i) => <div key={p.id} className={`bt-feed-line bt-t${p.team}${i === 0 ? ' is-now' : ''}${p.kind === 'td' || p.kind === 'final' ? ' is-big' : ''}`} style={p.team === 1 ? { '--tc': opp } : undefined}><small>{p.q}</small> {p.text}</div>)}</div>
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
// The host's run is the road. The partner mirrors the road (route, idx, lives,
// taken…) from it and keeps their own build and rewards. Builds are exchanged on
// join so the 2v2 (or the two football games) simulate identically on both phones.
const ROAD_KEYS = ['idx', 'taken', 'lives', 'seed', 'attempt', 'log', 'route', 'endless', 'start', 'lo', 'hi', 'won', 'endlessWins']
const roadOf = run => Object.fromEntries(ROAD_KEYS.map(k => [k, run[k]]))
function useDuo({ enabled, run, setRun, me, user, calcOvr, onCity }) {
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
    const shareBuild = () => room.send('build', { pos: runRef.current.pos, types: runRef.current.types, build: runRef.current.build, name: me.name, cos: me.cos, ovr: calcOvr(runRef.current.build) })
    room.onPresence(list => {
      const other = list.find(p => p.vid !== me.vid)
      setPartner(other ?? null)
      if (other) shareBuild()
      if (other && host) room.send('state', roadOf(runRef.current))
    })
    room.on('build', p => setPartnerPlayer({ id: 'partner', name: p.name, cos: p.cos ?? null, pos: p.pos, types: p.types, build: p.build, ovr: p.ovr }))
    room.on('state', p => { if (!host) setRun(r => (r ? { ...r, ...p, over: p.lives <= 0, justWon: false } : r)) })
    room.on('go', () => { if (!host) onCity() })
    room.on('chat', p => { if (!blockedIds().has(p.uid)) setChat(c => [...c.slice(-80), { id: `${p.from}-${p.ts}`, from: p.from, uid: p.uid, name: p.name, team: 0, text: clean(p.text), ts: p.ts, all: true }]) })
    return () => { room.leave(); roomRef.current = null }
  }, [enabled, code]) // eslint-disable-line
  // whenever my build changes (a reward), share it again
  useEffect(() => { if (roomRef.current && run) roomRef.current.send('build', { pos: run.pos, types: run.types, build: run.build, name: me.name, cos: me.cos, ovr: calcOvr(run.build) }) }, [run?.build]) // eslint-disable-line
  const sync = next => { if (host) roomRef.current?.send('state', roadOf(next)) }
  const sendChat = (text) => {
    const now = Date.now()
    if (!roomRef.current || now - lastChat.current < MIN_GAP_MS) return false
    const t = clean(text); if (!t) return false
    lastChat.current = now
    const msg = { uid: me.uid, name: me.name, team: 0, text: t, ts: now, all: true }
    roomRef.current.send('chat', msg)
    setChat(c => [...c.slice(-80), { id: `${me.vid}-${now}`, from: me.vid, ...msg }])
    return true
  }
  return { partner, partnerPlayer, chat, sync, chatApi: { chat, sendChat, me, match: { code } } }
}

// ── Intro: what Takeover is, and how your past runs went ─────────────────────
// Shown when there's no run on the road; START builds the player for a new one.
const RUN_DATE = { month: 'short', day: 'numeric' }
export function TakeoverIntro({ sport, teams, onStart, onClose }) {
  const isBucket = sport === 'bucket'
  const cities = useMemo(() => cityList(sport, teams), [sport, teams])
  const runs = useMemo(() => pastRuns(sport), [sport])
  const st = useProgress().stats ?? {}
  const best = runs.reduce((b, r) => Math.max(b, r.taken + (r.endless || 0)), 0)
  const done = runs.filter(r => r.won).length
  const steps = [
    ['Build your player', 'One draft, the same spins as a normal game. That build is who you take on the road.'],
    [`Cross ${STOPS} cities`, `Every stop has ${isBucket ? 'a star' : 'its best player at your position'} who rates higher than you. Beat them to take the city.`],
    ['Take their game', 'Every win is a prize: steal one of their ratings, a game plan for the next city, a rest, or the cash.'],
    ['Heat', 'Wins in a row build heat. Three straight and you\'re ON FIRE: a double steal, then a game with +1 on every rating. A loss puts it out.'],
    [`${LIVES} lives`, `A loss costs a life and you run that stop back. Lose all ${LIVES} and the run is over. Take all ${STOPS} and the road keeps going.`],
  ]
  return (
    <div className={`ag-screen ag-screen--${sport} tk tk-intro`}>
      <div className="ag-screen-head">
        <div>
          <span className="ag-eyebrow">ROAD MODE · SOLO OR DUO</span>
          <h1 className="ag-h1">Takeover</h1>
        </div>
        <button className="ag-round-btn" onClick={onClose} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <UsMap cities={cities} run={{ start: null, taken: [] }} here={null} next={null} />
        <ol className="tk-steps ag-pop" style={{ '--d': '80ms' }}>
          {steps.map(([t, d], i) => (
            <li key={t}><span className="tk-step-n">{i + 1}</span><span className="tk-step-txt"><b>{t}</b><small>{d}</small></span></li>
          ))}
        </ol>
        <p className="tk-intro-note ag-pop" style={{ '--d': '110ms' }}>Bring a friend with <b>DUO</b> from the road: two builds, one map, and the city falls if either of you wins.</p>
        <button className="ag-btn tk-intro-go ag-pop" style={{ '--d': '130ms' }} onClick={onStart}>BUILD A PLAYER · START A RUN <IconArrow size={16} /></button>

        <section className="tk-runs ag-pop" style={{ '--d': '160ms' }}>
          <div className="ag-card-head"><span className="ag-eyebrow">YOUR RUNS</span></div>
          <div className="tk-runs-stats">
            <span><b>{runs.length}</b><small>RUNS</small></span>
            <span><b>{best || '–'}</b><small>BEST RUN</small></span>
            <span><b>{done}</b><small>COMPLETED</small></span>
            <span><b>{st.tkCities ?? 0}</b><small>CITIES TAKEN</small></span>
          </div>
          {runs.length === 0
            ? <div className="tk-runs-empty">No runs yet. Your first road starts with a build.</div>
            : runs.slice(0, 8).map((r, i) => (
              <div key={r.at + '-' + i} className={`tk-run${r.won ? ' is-won' : ''}`}>
                <span className="tk-run-pos">{POS_LABEL[r.pos] ?? r.pos?.toUpperCase()}</span>
                <span className="tk-run-txt">
                  <b>{r.won ? <><IconTrophy size={13} /> Took all {r.stops}{r.endless ? ` · ${r.endless} more` : ''}</> : `${r.taken} of ${r.stops} cities`}</b>
                  <small>{new Date(r.at).toLocaleDateString(undefined, RUN_DATE)} · {r.mode === 'duo' ? 'Duo' : 'Solo'} · {r.wins}–{r.games - r.wins}</small>
                </span>
                {r.ovr != null && <span className="tk-run-ovr"><b>{r.ovr}</b><small>OVR</small></span>}
              </div>
            ))}
        </section>
      </div>
    </div>
  )
}
