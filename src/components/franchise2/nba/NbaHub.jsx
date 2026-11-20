import { useMemo, useRef, useState } from 'react'
import {
  TEAM, CONF_OF, CONF_NAME, DIV_OF, SHORTS, records, recText, pct, confOrder, gamesBack, streakText, nextMine, myGames, gameNo, dateText,
  playNext, simTo, startPostseason, playPoNight, simPostseason, mySeries, myPoGame, seriesText, ROUND_NAME, closeSeason, teamOvr,
  seasonText, CAP_SIM, nick, FINISH_TEXT, finishOf, nextStep,
} from '../../../lib/franchise2/nba'
import { sfx, haptic } from '../../../lib/juice'
import { IconClose } from '../../app/icons'
import { GamesSwitch } from '../../simFlow'
import { LeagueRules } from '../Rules'
import { fkVars, KLogo, Ticker, Scorebug, Stamp, TeamSlab, Go, Fold, Chyron, Banner } from '../kit'
import { GAMES_MODES, GAMES_WHAT, CAP_WHAT } from './NbaSetup'
import NbaGame, { NbaBox } from './NbaGame'
import NbaTeam from './NbaTeam'
import NbaLeague from './NbaLeague'
import NbaHistory from './NbaHistory'
import NbaOffseason from './NbaOffseason'
import '../season.css'
import '../gameday.css'

const TABS = [['season', 'Season'], ['team', 'Team'], ['league', 'League'], ['history', 'History']]
export const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
export const money = v => (v == null ? '-' : `$${(Math.round(v * 10) / 10).toFixed(1)}M`)
export const momentOpts = F => ({ moments: (F.moments ?? 'advanced') !== 'off' })

export default function NbaHub({ F, act, owner, onHome, onSlots, onDelete }) {
  const [tab, setTab] = useState('season')
  const [live, setLive] = useState(() => (F.pend ? { pend: true } : null))
  const [teamView, setTeamView] = useState(null)
  const scroll = useRef(null)
  const t = TEAM[F.team]
  const R = records(F)
  const off = F.phase === 'off'
  const toTab = (id, view = null) => { setTeamView(view); if (tab !== id) { setTab(id); sfx('tap'); scroll.current?.scrollTo(0, 0) } }
  // PLAY: the GM's next game on screen (the scorebug, a moment if it comes, the final)
  const play = () => {
    const before = F.log.length
    const out = act(X => (X.phase === 'season' ? playNext(X, momentOpts(X)) : playPoNight(X, momentOpts(X))))
    sfx('whistle'); haptic('medium')
    if (out?.pending) setLive({ pend: true })
    else if (F.log.length > before) setLive({ row: F.log[F.log.length - 1] })
  }
  const sub = F.phase === 'season' ? (nextMine(F) ? `${dateText(F, nextMine(F).d)} · Game ${gameNo(F, nextMine(F))}` : 'Regular season') : off ? 'Offseason' : F.phase === 'playin' ? 'Play-in' : F.phase === 'playoffs' ? ROUND_NAME[F.po.rd].toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()) : 'Season over'
  return (
    <div className="ag-screen f2 fk fk-root fh nb" style={fkVars(F.team)}>
      {live && <NbaGame F={F} act={act} start={live} owner={owner} onDone={() => setLive(null)} />}
      <div ref={scroll} className="fh-scroll">
        <header className="fh-top">
          <span className="fh-top-logo"><KLogo s={F.team} size={36} /></span>
          <span className="fh-top-txt">
            <b>{t.name}</b>
            <small>{seasonText(F.year)} · {sub}</small>
          </span>
          <button className="fh-x" onClick={onHome} aria-label="Leave Franchise"><IconClose size={16} /><span>Exit</span></button>
        </header>
        {tab === 'season' && !off && <LeagueTicker F={F} />}
        <nav className="fh-tabs" role="tablist" aria-label="Franchise">
          <div className="fh-tabs-in">
            {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => toTab(id)}>{id === 'season' && off ? 'Offseason' : label}</button>)}
          </div>
        </nav>
        <div className={`ag-screen-body fh-body fh-body--${tab}`}>
          {tab === 'season' && (off ? <NbaOffseason F={F} act={act} owner={owner} /> : <Season F={F} R={R} act={act} play={play} owner={owner} onTrades={() => toTab('team', 'trades')} />)}
          {tab === 'team' && <NbaTeam F={F} act={act} owner={owner} view={teamView} setView={setTeamView} />}
          {tab === 'league' && <NbaLeague F={F} owner={owner} />}
          {tab === 'history' && <NbaHistory F={F} owner={owner} onSlots={onSlots} onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

function LeagueTicker({ F }) {
  const items = useMemo(() => {
    const out = []
    const last = F.phase === 'season' ? F.day - 1 : null
    if (last != null) for (const g of F.sched.filter(x => x.d === last && x.hs != null)) out.push({ k: 'score', a: g.a, as: g.as, h: g.h, hs: g.hs, tag: g.ot ? 'F/OT' : 'FINAL' })
    for (const n of (F.news ?? []).slice(0, 8)) out.push({ k: 'news', tag: n.tag, s: n.s, text: n.text })
    return out
  }, [F, F.day, F.news?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null
  return <Ticker items={items} label="AROUND THE NBA" team={F.team} />
}

// ── SEASON ───────────────────────────────────────────────────────────────────
function Season({ F, R, act, play, owner, onTrades }) {
  const ph = F.phase
  return (
    <div className="fh-grid">
      <div className="fh-main">
        {ph === 'season' && <NextGame F={F} R={R} act={act} play={play} onTrades={onTrades} />}
        {ph === 'post' && <SeasonOver F={F} R={R} act={act} />}
        {(ph === 'playin' || ph === 'playoffs') && <PoCard F={F} act={act} play={play} />}
        {ph === 'done' && <Champions F={F} act={act} />}
        {(ph === 'season' || ph === 'post') && <Glance F={F} R={R} />}
        {(ph === 'playin' || ph === 'playoffs' || ph === 'done') && <Bracket F={F} />}
      </div>
      <aside className="fh-side">
        {F.log.length > 0 && <LastGame F={F} owner={owner} />}
        {(ph === 'season' || ph === 'post') && <ConfLadder F={F} R={R} />}
        {ph === 'season' && <Strip F={F} />}
        <GamesSwitch mode={F.moments ?? 'advanced'} modes={GAMES_MODES} what={GAMES_WHAT} title="Key moments" sub="the last possession of a close game"
          onPick={m => act(X => { X.moments = m })} cls={{ root: 'fh-games', top: 'fh-games-label', group: 'fh-seg' }} />
        <LeagueRules value={{ cap: !F.noCap, inj: !F.noInj }} nick={TEAM[F.team].nick} capWhat={CAP_WHAT}
          onChange={r => act(X => { if (r.cap != null) { if (r.cap) delete X.noCap; else X.noCap = 1 } if (r.inj != null) { if (r.inj) delete X.noInj; else { X.noInj = 1; for (const s of SHORTS) for (const p of X.teams[s].r) delete p.inj } } })} />
      </aside>
    </div>
  )
}

const seedIn = (F, R, s) => confOrder(F, CONF_OF[s], R).indexOf(s) + 1
function NextGame({ F, R, act, play, onTrades }) {
  const g = nextMine(F)
  if (!g) return null
  const home = g.h === F.team, opp = home ? g.a : g.h
  const b2b = F.sched.some(x => x.d === g.d - 1 && (x.h === F.team || x.a === F.team))
  const kind = DIV_OF[opp] === DIV_OF[F.team] ? `${DIV_OF[F.team]} Division` : CONF_OF[opp] === CONF_OF[F.team] ? `${CONF_NAME[CONF_OF[F.team]]} Conference` : 'Interconference'
  const sim = (to, label) => <button type="button" className="fh-textbtn" onClick={() => { act(X => { simTo(X, to) }); sfx('flip') }}>{label}</button>
  const ddl = F.day <= F.ddl, asb = F.day < F.asb[0]
  const sub = s => `${seedIn(F, R, s) ? `${ORD(seedIn(F, R, s))} in the ${CONF_OF[s] === 'E' ? 'East' : 'West'}` : ''}`
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>{dateText(F, g.d)}</b><span>Game {gameNo(F, g)} · {home ? 'Home' : 'Away'}{b2b ? ' · 2nd of a back-to-back' : ''}</span></div>
      <div className="fh-mu">
        {[g.a, g.h].map((s, k) => (
          <div key={s} className={`fh-mu-t${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
            <KLogo s={s} size={56} /><b>{TEAM[s].nick}</b><span>{recText(R[s])}</span><small>{R[s].g ? sub(s) : CONF_NAME[CONF_OF[s]]}</small>
          </div>
        )).reduce((a, x, i) => (i ? [...a, <span key="m" className="fh-mu-mid">at</span>, x] : [x]), [])}
      </div>
      <p className="fh-line">{kind}</p>
      {ddl && F.ddl - F.day <= 14 && <button type="button" className="fh-row nb-ddl" onClick={onTrades}><span><small>Trade deadline</small><b>{dateText(F, F.ddl)} · {F.ddl - F.day === 0 ? 'today' : `${F.ddl - F.day} days`}</b></span><i className="fh-row-go" aria-hidden="true">›</i></button>}
      <div className="fh-go">
        <Go onClick={play}>Play game {gameNo(F, g)}</Go>
        <div className="nb-sims">
          {sim(F.day + 7, 'Sim a week')}
          {ddl ? sim(F.ddl + 1, 'Sim to the deadline') : asb ? sim(F.asb[0], 'Sim to the All-Star break') : null}
          {sim(F.days, 'Sim to the end')}
        </div>
      </div>
    </section>
  )
}

function Glance({ F, R }) {
  const r = R[F.team], seed = seedIn(F, R, F.team)
  const cap = CAP_SIM.capSheet(F, F.team)
  const OVER = { under: 'under the cap', cap: 'over the cap', tax: 'in the tax', a1: 'over the first apron', a2: 'over the second apron' }
  return (
    <section className="fh-glance" aria-label={TEAM[F.team].nick}>
      <span><small>Record</small><b>{recText(r)}</b><em>{r.g ? `${ORD(seed)} in the ${CONF_OF[F.team] === 'E' ? 'East' : 'West'}${r.st && Math.abs(r.st) >= 2 ? ` · ${streakText(r)}` : ''}` : CONF_NAME[CONF_OF[F.team]]}</em></span>
      <span><small>Team OVR</small><b>{teamOvr(F, F.team)}</b><em>{ORD(SHORTS.slice().sort((a, b) => teamOvr(F, b) - teamOvr(F, a)).indexOf(F.team) + 1)} in the NBA</em></span>
      <span><small>Payroll</small><b>{money(cap.pay)}</b><em>{F.noCap ? 'no cap' : OVER[cap.over]}</em></span>
    </section>
  )
}

function LastGame({ F, owner }) {
  const g = F.log[F.log.length - 1]
  const [box, setBox] = useState(false)
  const a = g.home ? g.opp : F.team, h = g.home ? F.team : g.opp
  const as = g.home ? g.them : g.us, hs = g.home ? g.us : g.them
  return (
    <section className="fh-last">
      <h3 className="fh-h"><b>{g.po ? g.po.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase()) : 'Last game'}</b><span className={`fh-res is-${g.w ? 'w' : 'l'}`}>{g.w ? 'Win' : 'Loss'}</span></h3>
      <Scorebug a={a} h={h} as={as} hs={hs} final={g.ot ? (g.ot > 1 ? `F/${g.ot}OT` : 'F/OT') : 'FINAL'} />
      {F.box?.[g.bx] && <button type="button" className="fh-textbtn" onClick={() => { setBox(true); sfx('tap') }}>Box score</button>}
      {box && <NbaBox F={F} b={F.box[g.bx]} owner={owner} onClose={() => setBox(false)} />}
    </section>
  )
}

function ConfLadder({ F, R }) {
  const c = CONF_OF[F.team]
  const L = confOrder(F, c, R)
  const lead = L[0]
  return (
    <section className="nb-ladder">
      <h3 className="fh-h"><b>{CONF_NAME[c]} Conference</b><span>GB</span></h3>
      <div className="fh-ladder">
        {L.map((s, k) => (
          <div key={s} className={`fh-rung nb-rung${s === F.team ? ' is-me' : ''}${k === 5 || k === 9 ? ' is-cut' : ''}`} style={fkVars(s)}>
            <i>{k + 1}</i><KLogo s={s} size={24} /><b>{TEAM[s].nick}</b><span>{recText(R[s])}<small>{k ? (gamesBack(R, lead, s) ? gamesBack(R, lead, s).toFixed(1).replace('.0', '') : '-') : '-'}</small></span>
          </div>
        ))}
      </div>
    </section>
  )
}
function Strip({ F }) {
  const G = myGames(F)
  const k = G.findIndex(g => g.hs == null)
  const shown = G.slice(Math.max(0, k - 5), Math.max(0, k - 5) + 10)
  return (
    <div className="fh-strip-wrap">
      <h3 className="fh-h"><b>Schedule</b><span>{G.filter(g => g.hs != null).length} of 82</span></h3>
      <div className="fh-strip">
        {shown.map(g => {
          const home = g.h === F.team, opp = home ? g.a : g.h
          const done = g.hs != null, won = done && (home ? g.hs > g.as : g.as > g.hs)
          return (
            <div key={`${g.d}-${opp}`} className={`fh-wk${done ? (won ? ' is-w' : ' is-l') : ''}${g === G[k] ? ' is-now' : ''}`}>
              <small>{dateText(F, g.d)}</small>
              <span className="fh-wk-logo">{!home && <i>@</i>}<KLogo s={opp} size={26} /></span>
              <b>{done ? `${won ? 'W' : 'L'} ${home ? g.hs : g.as}-${home ? g.as : g.hs}` : TEAM[opp].short}</b>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeasonOver({ F, R, act }) {
  const r = R[F.team], seed = seedIn(F, R, F.team)
  const fate = seed <= 6 ? 'Into the playoffs' : seed <= 10 ? 'Into the play-in' : 'Out of the postseason'
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>Regular season over</b><span>{recText(r)} · {ORD(seed)} in the {CONF_OF[F.team] === 'E' ? 'East' : 'West'}</span></div>
      <Stamp kind={seed <= 10 ? 'w' : 'l'} big>{fate.toUpperCase()}</Stamp>
      <div className="fh-go"><Go onClick={() => { act(X => { startPostseason(X) }); sfx('whistle') }}>{seed <= 10 ? 'Start the postseason' : 'Watch the postseason'}</Go></div>
    </section>
  )
}

function PoCard({ F, act, play }) {
  const P = F.po
  const mine = myPoGame(F)
  const S = mySeries(F)
  const title = F.phase === 'playin' ? 'Play-In Tournament' : ROUND_NAME[P.rd]
  const night = () => { act(X => { playPoNight(X) }); sfx('flip') }
  const all = () => { act(X => { simPostseason(X) }); sfx('flip') }
  return (
    <section className="fh-next">
      <div className="fh-next-h"><b>{title.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase())}</b><span>{S ? seriesText(S, F.team) : mine ? 'Win or go home' : 'Eliminated'}</span></div>
      {mine ? (
        <>
          <div className="fh-mu">
            {[mine.a, mine.h].map(s => <div key={s} className={`fh-mu-t${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}><KLogo s={s} size={56} /><b>{TEAM[s].nick}</b><small>{seedText(F, s)}</small></div>).reduce((a, x, i) => (i ? [...a, <span key="m" className="fh-mu-mid">at</span>, x] : [x]), [])}
          </div>
          <div className="fh-go"><Go onClick={play}>{mine.n && S ? `Play game ${mine.n}` : 'Play the game'}</Go><button type="button" className="fh-textbtn" onClick={all}>Sim the rest of the postseason</button></div>
        </>
      ) : (
        <div className="fh-go"><Go onClick={night}>Next night</Go><button type="button" className="fh-textbtn" onClick={all}>Sim the rest of the postseason</button></div>
      )}
    </section>
  )
}
export const seedText = (F, s) => { const c = CONF_OF[s], i = (F.po?.final?.[c] ?? F.po?.seeds?.[c] ?? []).indexOf(s); return i >= 0 ? `No. ${i + 1} ${c === 'E' ? 'East' : 'West'}` : '' }

function Bracket({ F }) {
  const P = F.po
  if (!P) return null
  const rounds = [...(P.all ?? []), ...(P.stage === 'r' && P.S ? [P.S] : [])]
  return (
    <section className="nb-bracket">
      <h3 className="fh-h"><b>Bracket</b><span>{F.phase === 'playin' ? 'Play-in' : ''}</span></h3>
      {F.phase === 'playin' && ['E', 'W'].map(c => (
        <div key={c} className="nb-pi">
          <small>{c === 'E' ? 'EAST' : 'WEST'} PLAY-IN</small>
          {(P.cur ?? []).filter(g => g.c === c).map(g => <SeriesRow key={g.k} F={F} hi={g.h} lo={g.a} txt={g.k === '78' ? '7 v 8' : g.k === '910' ? '9 v 10' : 'For the 8 seed'} />)}
        </div>
      ))}
      {rounds.map((rd, k) => (
        <div key={k} className="nb-round">
          <small>{ROUND_NAME[k]}</small>
          {rd.map(S => <SeriesRow key={S.hi + S.lo} F={F} hi={S.hi} lo={S.lo} S={S} />)}
        </div>
      ))}
    </section>
  )
}
function SeriesRow({ F, hi, lo, S, txt }) {
  const won = s => S?.done === s
  return (
    <div className={`nb-ser${hi === F.team || lo === F.team ? ' is-me' : ''}`}>
      {[hi, lo].map(s => (
        <span key={s} className={`nb-ser-t${S?.done && !won(s) ? ' is-out' : ''}`} style={fkVars(s)}>
          <KLogo s={s} size={22} /><b>{TEAM[s].short}</b>{S && <em>{s === hi ? S.wh : S.wl}</em>}
        </span>
      ))}
      {txt && <small>{txt}</small>}
    </div>
  )
}

function Champions({ F, act }) {
  const P = F.po
  const champ = P.champ, fin = P.all[3][0]
  const me = champ === F.team
  return (
    <section className={`fh-next${me ? ' is-sb' : ''}`}>
      <div className="fh-next-h"><b>{seasonText(F.year)} NBA champions</b><span>{nick(champ)} win the Finals {Math.max(fin.wh, fin.wl)}-{Math.min(fin.wh, fin.wl)}</span></div>
      <TeamSlab s={champ} size="l" sub="NBA CHAMPIONS" />
      {me && <Stamp kind="gold" big>CHAMPIONS</Stamp>}
      {!me && <p className="fh-next-note">{FINISH_TEXT[finishOf(F, F.team)]}.</p>}
      <div className="fh-go"><Go onClick={() => { act(X => { closeSeason(X) }); sfx('whistle') }}>Into the offseason</Go></div>
    </section>
  )
}
export { Banner, Chyron, Fold }
