import { useContext, useMemo, useState } from 'react'
import {
  TEAM, CONF_OF, CONF_NAME, SHORTS, records, recText, pct, dateText, nick, manOf, teamOfMan, alive, mySeries, myPoGame,
  CAP_SIM, STRETCH_NAME, stretchGames, stretchDates, stretchRecap, lightNext, boxOf, perLine, roundResult, lightRound, lightStep, LIGHT_STEPS,
  lightToDraft, lightOpenFA, resignList, callOf, lightResign, marketFits, offerFor, offerChance, lightFA, bigDeals, sheetNews, lightCamp, campCuts,
  lightNewSeason, lightRest, teamOvr, addNews,
} from '../../../lib/franchise2/nba'
import { sfx, haptic } from '../../../lib/juice'
import { fkVars, KLogo, Chyron, LowerThird, Go, ActionBar, BigRec, Fold, Stamp } from '../kit'
import { manPhoto } from './NbaBuilds'
import { NbaBox } from './NbaGame'
import { CapBar } from './NbaTeam'
import { money, ORD, seedText } from './NbaHub'
import { ManSheetHost, ManOpen, tapMan, Awards, Draft, Camp, Development, KeptList, snapLeague, devOf } from './NbaOffseason'
import '../light.css'
import './nbaoff.css'
import './nblight.css'

// BASKETBALL FRANCHISE LIGHT's screens (engine: lib/franchise2/nba/light.js), football's Light.jsx on the NBA's
// calendar. LIGHT never goes into a game: every night and every postseason round is simmed, each result with its box
// score. The rest is FULL's: the hub's standings and schedule, the bracket and the champions, the Team, League and
// History tabs, the awards, the draft, camp.
//   StretchCard     the season card: the stretch's games (the ones to watch), PLAY TO CHRISTMAS
//   StretchRecap    the stretch played: the record, the builds' lines, the conference, who got hurt, the wire, every
//                   result with its box score, and the one button on
//   PoLight         the postseason a round a tap: the round just simmed (the series, each game), the next one
//   LightOffseason  the summer's three steps: THE DRAFT → FREE AGENCY → CAMP
const yrs = y => `${y} ${y === 1 ? 'YR' : 'YRS'}`
const toTop = () => { try { const b = document.querySelector('.fh-scroll'); if (b) b.scrollTo(0, 0); else window.scrollTo(0, 0) } catch { /* (no scroll box) */ } }
const PLAY = ['Play to Christmas', 'Play to the deadline', 'Play the stretch run']
const confWord = c => (c === 'E' ? 'East' : 'West')

// ═════════════════════════════════════════════════════════════════════════════
// THE SEASON
// ═════════════════════════════════════════════════════════════════════════════
// the stretch's games: how many, at home, on back-to-backs, then the ones to watch (Christmas, the league's best
// records, the division), one line each
export function StretchCard({ F, play, simToEnd, onTrades }) {
  const L = F.lt
  const R = records(F)
  // (the games still to play: a stretch picked up partway shows what's left of it)
  const games = stretchGames(F, L.k).filter(g => g.hs == null)
  const mineDays = new Set(F.sched.filter(g => g.h === F.team || g.a === F.team).map(g => g.d))
  const home = games.filter(g => g.h === F.team).length
  const b2b = games.filter(g => mineDays.has(g.d - 1)).length
  // (the league's best: by record once games are played, by team OVR before)
  const played = R[F.team]?.g > 0
  const best = SHORTS.slice().sort((a, b) => (played ? pct(R[b]) - pct(R[a]) : 0) || teamOvr(F, b) - teamOvr(F, a)).filter(s => s !== F.team).slice(0, 8)
  const watch = games.map(g => {
    const opp = g.h === F.team ? g.a : g.h
    const xmas = dateText(F, g.d) === 'DEC 25'
    const v = (xmas ? 10 : 0) + (best.includes(opp) ? 8 - best.indexOf(opp) : 0)
    return { g, opp, xmas, v }
  }).filter(x => x.v > 0).sort((a, b) => b.v - a.v).filter((x, i, a) => x.xmas || a.findIndex(y => y.opp === x.opp) === i).slice(0, 4).sort((a, b) => a.g.d - b.g.d)
  const ddlIn = F.day <= F.ddl
  const place = s => { const i = confRank(F, s, R); return R[s]?.g ? `${ORD(i)} in the ${confWord(CONF_OF[s])}` : CONF_NAME[CONF_OF[s]] }
  return (
    <section className="fh-next lt-card nl-card">
      <div className="fh-next-h"><b>{STRETCH_NAME[L.k]}</b><span>Stretch {L.k + 1} of 3</span></div>
      <div className="lt-rec">
        <span className="lt-rec-all"><b>{games.length}</b><small>Games</small></span>
        <span className="lt-rec-all"><b>{home}-{games.length - home}</b><small>Home-away</small></span>
        <span className="lt-rec-all"><b>{b2b}</b><small>Back-to-backs</small></span>
      </div>
      {watch.length > 0 && <h3 className="fh-h"><b>Games to watch</b><span>{stretchDates(F, L.k)}</span></h3>}
      <div className="lt-opps nl-opps" role="list" aria-label="Games to watch">
        {watch.map(({ g, opp, xmas }) => (
          <div key={`${g.d}-${opp}`} role="listitem" className="lt-opp" style={fkVars(opp)}>
            <span className="lt-opp-wk">{dateText(F, g.d)}</span>
            <span className="lt-opp-t"><i>{g.h === F.team ? 'vs' : '@'}</i><KLogo s={opp} size={26} /><b>{TEAM[opp].nick}</b></span>
            <span className="lt-opp-rec"><b>{recText(R[opp])}</b><small>{xmas ? 'Christmas Day' : place(opp)}</small></span>
          </div>
        ))}
      </div>
      {ddlIn && (
        <button type="button" className="fh-row nb-ddl" onClick={onTrades}>
          <span><small>Trade deadline</small><b>{dateText(F, F.ddl)} · {F.day === F.ddl ? 'today: trades go through until tonight' : L.k === 0 ? 'after the next stretch' : 'after this stretch'}</b></span>
          <i className="fh-row-go" aria-hidden="true">›</i>
        </button>
      )}
      <p className="fh-next-note">Every game is simmed, with its box score.</p>
      <div className="fh-go">
        <Go onClick={play}>{PLAY[L.k]}</Go>
        <button type="button" className="fh-textbtn" onClick={simToEnd}>Sim to the postseason</button>
      </div>
    </section>
  )
}
const confRank = (F, s, R) => { const c = CONF_OF[s]; return SHORTS.filter(x => CONF_OF[x] === c).sort((a, b) => pct(R[b]) - pct(R[a])).indexOf(s) + 1 }

// ── The stretch's recap ──────────────────────────────────────────────────────
function hurtText(x) {
  const what = x.what ? ` (${x.what})` : ''
  return `${x.n}${what}: ${x.se ? 'out for the season' : x.g >= 14 ? `out about ${Math.round(x.g / 3.5)} weeks` : `out ${x.g} ${x.g === 1 ? 'game' : 'games'}`}`
}
export function StretchRecap({ F, act, owner, onTrades }) {
  const L = F.lt
  const X = useMemo(() => stretchRecap(F), [F, F.day, L?.ph]) // eslint-disable-line react-hooks/exhaustive-deps
  const [box, setBox] = useState(null)
  const open = useContext(ManOpen)
  if (!X) return null
  const last = L.k === 2
  const c = CONF_OF[F.team]
  const R = records(F)
  const next = () => { act(Y => lightNext(Y)); sfx('whistle'); haptic('medium'); toTop() }
  const fate = X.seed <= 6 ? 'into the playoffs' : X.seed <= 10 ? 'into the play-in' : 'out of the postseason'
  return (
    <section className="fh-next lt-recap nl-recap">
      <div className="fh-next-h"><b>{STRETCH_NAME[L.k]}</b>{last ? <span>Regular season final</span> : <span>{stretchDates(F, L.k)}</span>}</div>
      <div className="lt-rec">
        <BigRec w={X.rec.w} l={X.rec.l} size={64} label="SEASON" />
        <span className="lt-rec-all"><b>{X.w}-{X.l}</b><small>These games</small></span>
        <span className="lt-rec-all"><b>{ORD(X.seed)}</b><small>{CONF_NAME[c]}</small></span>
      </div>
      {last && <Stamp kind={X.seed <= 10 ? 'w' : 'l'} className="nl-fate">{`${nick(F.team).toUpperCase()} ${fate.toUpperCase()}`}</Stamp>}
      {L.k === 1 && F.phase === 'season' && F.day === F.ddl && (
        <button type="button" className="fh-row nb-ddl" onClick={onTrades}>
          <span><small>Deadline day</small><b>Trades go through until tonight's games</b></span>
          <i className="fh-row-go" aria-hidden="true">›</i>
        </button>
      )}
      {X.builds.length > 0 && (
        <div className="lt-sec">
          <h3 className="fh-h"><b>{owner}'s builds</b><span>These games</span></h3>
          {X.builds.map(b => (
            <div key={b.p.i} className="lt-aw">
              <LowerThird name={b.p.n} pos={b.p.p} num={b.p.num} ovr={b.p.o} photo={manPhoto(F, b.p)} team={F.team} mine={owner} size="s" line={b.gp ? `${b.gp} ${b.gp === 1 ? 'GAME' : 'GAMES'}` : b.p.inj?.g ? 'INJURED' : 'DID NOT PLAY'} onClick={open ? () => { open(b.p.i); sfx('tap') } : undefined} />
              {b.gp > 0 && <span className="lt-aw-line">{perLine(b.t)}</span>}
            </div>
          ))}
        </div>
      )}
      {X.as.length > 0 && (
        <div className="lt-sec">
          <h3 className="fh-h"><b>All-Stars</b><span>{X.asg ? `${X.asg.s === 'E' ? 'East' : 'West'} won ${Math.max(X.asg.E, X.asg.W)}-${Math.min(X.asg.E, X.asg.W)}` : ''}</span></h3>
          {X.as.map(i => { const p = manOf(F, i); return p ? <p key={i} className="lt-line">{`${p.n} made the All-Star team${(F.as?.E?.st ?? []).concat(F.as?.W?.st ?? []).includes(i) ? ' as a starter' : ''}.`}</p> : null })}
        </div>
      )}
      <div className="lt-sec">
        <h3 className="fh-h"><b>{CONF_NAME[c]} Conference</b><span>{X.seed <= 6 ? 'Playoff spot' : X.seed <= 10 ? 'Play-in spot' : `${X.seed - 10} out of the play-in`}</span></h3>
        <div className="fh-ladder">
          {X.conf.map((s, k) => [s, k]).slice(Math.max(0, Math.min(X.seed - 3, X.conf.length - 5)), Math.max(0, Math.min(X.seed - 3, X.conf.length - 5)) + 5).map(([s, k]) => (
            <div key={s} className={`fh-rung nb-rung${s === F.team ? ' is-me' : ''}${k === 5 || k === 9 ? ' is-cut' : ''}`} style={fkVars(s)}>
              <i>{k + 1}</i><KLogo s={s} size={24} /><b>{TEAM[s].nick}</b><span>{recText(R[s])}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="lt-sec">
        <h3 className="fh-h"><b>Injuries</b><span>{X.hurt.length ? `${X.hurt.length} out five games or more` : X.minor.length ? 'Day to day only' : 'None'}</span></h3>
        {X.hurt.map(x => <p key={`${x.id}-${x.d}`} className="lt-line is-inj">{hurtText(x)}</p>)}
        {X.minor.length > 0 && <p className="lt-line">{`Day to day: ${X.minor.join(', ')} ${X.minor.length === 1 ? 'missed' : 'each missed'} a few games.`}</p>}
        {!X.hurt.length && !X.minor.length && <p className="lt-line">{`Nobody on the ${TEAM[F.team].nick} was hurt in these games.`}</p>}
      </div>
      {X.wire.length > 0 && (
        <div className="lt-sec">
          <h3 className="fh-h"><b>Around the league</b></h3>
          {X.wire.map(x => <p key={x.text} className="lt-line lt-wire" style={x.s ? fkVars(x.s) : undefined}>{x.s && <KLogo s={x.s} size={20} />}<span>{x.text}</span></p>)}
        </div>
      )}
      <Fold className="nl-results" title="Every result" right={`${X.rows.length} games · ${X.w}-${X.l}`}>
        <div className="lt-games" role="list">
          {X.rows.map(r => {
            const b = boxOf(F, r)
            return (
              <button key={`${r.d}-${r.opp}`} type="button" role="listitem" className={`lt-game nl-game is-${r.w ? 'w' : 'l'}`} style={fkVars(r.opp)} onClick={() => { if (b) { setBox(b); sfx('tap') } }} disabled={!b} aria-label={`${dateText(F, r.d)}: ${r.w ? 'won' : 'lost'} ${r.us}-${r.them} ${r.home ? 'against' : 'at'} the ${nick(r.opp)}${b ? '. Box score' : ''}`}>
                <span className="lt-game-wk">{dateText(F, r.d)}</span>
                <span className="lt-game-opp"><i>{r.home ? 'vs' : '@'}</i><KLogo s={r.opp} size={24} /><b>{TEAM[r.opp].short}</b></span>
                <span className="lt-game-sc"><b>{r.w ? 'W' : 'L'} {r.us}-{r.them}{r.ot ? (r.ot > 1 ? ` ${r.ot}OT` : ' OT') : ''}</b></span>
                {b && <i className="lt-game-go" aria-hidden="true">›</i>}
              </button>
            )
          })}
        </div>
      </Fold>
      <ActionBar><Go onClick={next}>{last ? (X.seed <= 10 ? 'On to the postseason' : 'Watch the postseason') : `Next: ${STRETCH_NAME[L.k + 1]}`}</Go></ActionBar>
      {box && <NbaBox F={F} b={box} owner={owner} onClose={() => setBox(null)} />}
    </section>
  )
}

// ── The postseason, a round a tap ────────────────────────────────────────────
const RD_VERB = ['Sim the first round', 'Sim the second round', 'Sim the conference finals', 'Sim the NBA Finals']
const RD_TITLE = ['First round', 'Conference semifinals', 'Conference finals', 'NBA Finals']
export function PoLight({ F, act, owner }) {
  const P = F.po
  if (!P) return null
  const inIt = alive(F)
  const mine = myPoGame(F), S = mySeries(F)
  const pi = F.phase === 'playin'
  const title = pi ? 'Play-In Tournament' : RD_TITLE[P.rd]
  const verb = P.rd === 2 ? `Sim the ${confWord(CONF_OF[F.team])} finals` : RD_VERB[P.rd]
  const bye = pi && P.seeds[CONF_OF[F.team]].slice(0, 6).includes(F.team)
  const sim = () => { act(X => lightRound(X)); sfx('whistle'); haptic('medium'); toTop() }
  const rest = () => { act(X => { lightRest(X) }); sfx('flip'); toTop() }
  const opp = S ? (S.hi === F.team ? S.lo : S.hi) : mine ? (mine.h === F.team ? mine.a : mine.h) : null
  const status = S ? (S.g.length ? `Series ${S.wh}-${S.wl}` : `Best of seven · ${S.hi === F.team ? 'home court' : `the ${nick(S.hi)} have home court`}`) : bye ? 'Into the first round: the play-in sets the 7 and 8 seeds' : mine ? (mine.k === '78' ? 'For the No. 7 seed · the loser plays again' : 'Win or go home') : 'Out of the postseason'
  return (
    <>
      <RoundDone F={F} owner={owner} />
      <section className="fh-next nl-po">
        <div className="fh-next-h"><b>{title}</b><span>{inIt ? status : 'Out of the postseason'}</span></div>
        {inIt && opp && (
          <div className="fh-mu">
            {[opp, F.team].map(s => <div key={s} className={`fh-mu-t${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}><KLogo s={s} size={56} /><b>{TEAM[s].nick}</b><small>{seedText(F, s)}</small></div>).reduce((a, x, i) => (i ? [...a, <span key="m" className="fh-mu-mid">vs</span>, x] : [x]), [])}
          </div>
        )}
        {!inIt && <p className="fh-next-note">{`The ${/s$/.test(nick(F.team)) ? `${nick(F.team)}'` : `${nick(F.team)}'s`} season is over. The rest of the postseason is simmed to the champion.`}</p>}
        <div className="fh-go">
          {inIt ? <Go onClick={sim}>{pi ? 'Sim the play-in' : verb}</Go> : <Go onClick={rest}>Sim to the champion</Go>}
          {inIt && <button type="button" className="fh-textbtn" onClick={rest}>Sim the rest of the postseason</button>}
        </div>
      </section>
    </>
  )
}
// the round just simmed: the series (or the play-in games), each game's final with its box score
export function RoundDone({ F, owner }) {
  const [box, setBox] = useState(null)
  const X = roundResult(F)
  if (!X) return null
  const won = s => `${nick(s)} win ${Math.max(X.S.wh, X.S.wl)}-${Math.min(X.S.wh, X.S.wl)}`
  const title = X.ph === 'playin' ? 'Play-in' : RD_TITLE[X.rd]
  const opp = X.S ? (X.S.hi === F.team ? X.S.lo : X.S.hi) : null
  const line = X.ph === 'playin' ? (X.seed ? `The ${nick(F.team)} take the No. ${X.seed} seed in the ${confWord(CONF_OF[F.team])}` : `The ${nick(F.team)} are eliminated in the play-in`)
    : X.S ? (X.won ? `The ${nick(F.team)} beat the ${nick(opp)} ${Math.max(X.S.wh, X.S.wl)}-${Math.min(X.S.wh, X.S.wl)}${X.rd === 3 ? ' to win the NBA championship' : ''}` : `The ${nick(opp)} eliminate the ${nick(F.team)} ${Math.max(X.S.wh, X.S.wl)}-${Math.min(X.S.wh, X.S.wl)}`) : null
  if (!line) return null
  const res = X.ph === 'playin' ? (X.seed ? 'w' : 'l') : X.won ? 'w' : 'l'
  return (
    <section className="fh-next lt-round nl-round">
      <div className="fh-next-h"><b>{title}</b><span>{X.S ? won(X.S.done) : 'Final'}</span></div>
      <div className="lt-round-hl"><Stamp kind={res} delay={200}>{res === 'w' ? (X.rd === 3 ? 'CHAMPIONS' : 'ADVANCE') : 'OUT'}</Stamp><span><b>{line.split(/(\d-\d)/).map((t, j) => (j % 2 ? <span key={j} className="nl-nw">{t}</span> : t))}</b></span></div>
      {X.rows.length > 0 && (
        <div className="lt-games" role="list">
          {X.rows.map((r, j) => {
            const b = boxOf(F, r)
            return (
              <button key={`${r.d}-${j}`} type="button" role="listitem" className={`lt-game nl-game is-${r.w ? 'w' : 'l'}`} style={fkVars(r.opp)} onClick={() => { if (b) { setBox(b); sfx('tap') } }} disabled={!b}>
                <span className="lt-game-wk">{X.S ? `Game ${j + 1}` : 'Play-in'}</span>
                <span className="lt-game-opp"><i>{r.home ? 'vs' : '@'}</i><KLogo s={r.opp} size={24} /><b>{TEAM[r.opp].short}</b></span>
                <span className="lt-game-sc"><b>{r.w ? 'W' : 'L'} {r.us}-{r.them}{r.ot ? (r.ot > 1 ? ` ${r.ot}OT` : ' OT') : ''}</b></span>
                {b && <i className="lt-game-go" aria-hidden="true">›</i>}
              </button>
            )
          })}
        </div>
      )}
      {box && <NbaBox F={F} b={box} owner={owner} onClose={() => setBox(null)} />}
    </section>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// THE OFFSEASON: three steps
// ═════════════════════════════════════════════════════════════════════════════
export function LightOffseason(props) {
  return <ManSheetHost {...props}><Summer {...props} /></ManSheetHost>
}
function Summer({ F, act, owner }) {
  const i = lightStep(F)
  const st = F.off?.step ?? 'awards'
  const go = (fn, s = 'whistle') => { act(fn); sfx(s); haptic('medium'); toTop() }
  const toDraft = () => go(X => { lightToDraft(X) })
  const toFA = () => go(X => { const was = snapLeague(X); lightOpenFA(X); if (X.off) X.off.dev = devOf(X, was) })
  const L = F.lt?.y === F.year ? F.lt : null
  return (
    <div className="nb-off lt-off">
      <nav className="nbo-steps nl-steps" aria-label="Offseason steps">
        {LIGHT_STEPS.map((n, j) => (
          <span key={n} className={j === i ? 'is-on' : j < i ? 'is-done' : ''} aria-current={j === i ? 'step' : undefined}><i>{j < i ? '✓' : j + 1}</i>{n}</span>
        ))}
      </nav>
      <div className="lt-off-main">
        {i === 0 && (st === 'draft' ? <><LotteryLine F={F} /><Draft F={F} act={act} go={toFA} next="Next: Free agency" /></> : <Awards F={F} act={act} go={toDraft} next="Draft night" />)}
        {i === 1 && st === 'resign' && <Resign F={F} act={act} owner={owner} />}
        {i === 1 && st === 'fa' && (L?.done || !L ? <MarketDone F={F} act={act} owner={owner} /> : <Market F={F} act={act} owner={owner} />)}
        {i === 2 && <><CampCalls F={F} act={act} /><Camp F={F} act={act} owner={owner} go={() => go(X => { lightNewSeason(X) })} /></>}
      </div>
    </div>
  )
}

// the lottery's result in a line (the drawing the scouts and the front office watched): who moved up, his own pick
function LotteryLine({ F }) {
  const L = F.lot
  if (!L?.lottery?.length) return null
  const owner = s => (F.picks ?? []).find(p => p.y === L.y && p.r === 1 && p.o === s)?.t ?? s
  const top = L.lottery.slice().sort((a, b) => a.to - b.to).slice(0, 4)
  const mine = draftPicks(F)
  return (
    <section className="lt-sec">
      <Chyron tone="ink" size="s" title={`${L.y} Draft Lottery`} sub={mine.length ? `${nick(F.team).toUpperCase()} PICK ${mine.join(', ')}` : `${nick(F.team).toUpperCase()}: NO PICKS`} />
      <ol className="nbo-dev-list">
        {top.map(x => {
          const o = owner(x.s)
          return (
            <li key={x.s} className={o === F.team ? 'is-me' : ''} style={fkVars(x.s)}>
              <KLogo s={x.s} size={20} />
              <span><b>{`No. ${x.to}: ${TEAM[x.s].nick}`}</b><small>{[x.to < x.from ? `UP FROM ${x.from}` : x.to > x.from ? `DOWN FROM ${x.from}` : `STAYED AT ${x.from}`, `${x.odds.toFixed(1)}% FOR NO. 1`, o !== x.s ? `PICK OWNED BY ${TEAM[o].short}` : null].filter(Boolean).join(' · ')}</small></span>
            </li>
          )
        })}
      </ol>
      {(F.sp ?? 0) === 0 && <p className="nbo-note">{`The ${nick(F.team)}' scouts spent the spring on the men projected around their first pick.`}</p>}
    </section>
  )
}
const draftPicks = F => (F.picks ?? []).filter(p => p.y === F.year + 1 && p.t === F.team && p.n).map(p => p.n).sort((a, b) => a - b)

// ── 2. FREE AGENCY: the re-sign calls ───────────────────────────────────────
const RIGHTS = { bird: 'BIRD RIGHTS', ebird: 'EARLY BIRD', nbird: 'NON-BIRD' }
const rightsOf = p => (!p.fr || p.rn ? null : (p.bird ?? 0) >= 3 ? 'bird' : p.bird === 2 ? 'ebird' : 'nbird')
function Resign({ F, act, owner }) {
  const open = useContext(ManOpen)
  const list = resignList(F)
  const set = (p, c) => { act(X => { X.lt = { ...(X.lt ?? { y: X.year, ph: 'rs' }), rs: { ...(X.lt?.rs ?? {}), [p.i]: c } } }); sfx(c === 'go' ? 'swap' : 'claim') }
  const done = () => { act(X => { lightResign(X) }); sfx('whistle'); haptic('medium'); toTop() }
  const ret = F.off?.ret ?? []
  return (
    <section className="nb-resign">
      <Development F={F} />
      {ret.length > 0 && <p className="lt-line">{ret.map(r => `${r.n} retires at ${r.ag} after ${r.yrs} ${r.yrs === 1 ? 'season' : 'seasons'}.`).join(' ')}</p>}
      <CapBar F={F} />
      <Chyron team={F.team} title="Re-sign" right={list.length || null} sub={list.length ? 'SET TO THE FRONT OFFICE’S CALL · CHANGE ANY OF THEM' : 'NO DEALS ARE UP'} />
      {list.length > 0 && <p className="nbo-note">{`Keep a man and he signs at his ask, with his rights. A tendered qualifying offer keeps a restricted man restricted: the ${nick(F.team)} can match any offer sheet. Let a man go and his cap hold comes off the books.`}</p>}
      <div className="nl-list">
      {list.map(({ p, d, c, rfa }) => {
        const call = callOf(F, p)
        const rt = rightsOf(p)
        const can = !!d && !!c?.ok
        return (
          <div key={p.i} className={`lt-pick${call === 'go' ? ' is-off' : ''}`}>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} mine={p.b != null ? owner : null} size="s" line={[`AGE ${p.ag}`, rt ? RIGHTS[rt] : null, p.rfa ? 'RFA' : null].filter(Boolean).join(' · ')} onClick={open ? () => { open(p.i); sfx('tap') } : undefined} />
            <div className={`lt-seg${rfa ? ' nl-seg3' : ''}`} role="radiogroup" aria-label={p.n}>
              <button type="button" role="radio" aria-checked={call === 'keep'} className={call === 'keep' ? 'is-on' : ''} disabled={!can} onClick={() => call !== 'keep' && set(p, 'keep')}>
                <span>{can ? 'Keep' : d ? 'Can’t keep' : 'Wants the market'}</span>{d && <small>{`${money(d.$)} × ${d.y}`}</small>}
              </button>
              {rfa && <button type="button" role="radio" aria-checked={call === 'qo'} className={call === 'qo' ? 'is-on' : ''} onClick={() => call !== 'qo' && set(p, 'qo')}><span>Tender QO</span><small>{p.qtw ? 'Two-way' : money(p.qo)}</small></button>}
              <button type="button" role="radio" aria-checked={call === 'go'} className={call === 'go' ? 'is-on' : ''} onClick={() => call !== 'go' && set(p, 'go')}><span>Let go</span></button>
            </div>
            {d && !can && <p className="lt-warn">{String(c?.why ?? 'His deal doesn’t fit').replace(/\.$/, '')}.</p>}
            {call === 'go' && p.b != null && <p className="lt-warn">{`${p.n} leaves the ${nick(F.team)} if he isn't re-signed.`}</p>}
          </div>
        )
      })}
      </div>
      <ActionBar><Go onClick={done}>Next: The market</Go></ActionBar>
    </section>
  )
}

// ── 2. FREE AGENCY: the market's best fits ──────────────────────────────────
const CHANCE = { likely: ['LIKELY TO SIGN', 'w'], close: ['TOO CLOSE TO CALL', 'n'], unlikely: ['UNLIKELY AT THIS PRICE', 'l'] }
function Market({ F, act, owner }) {
  const open = useContext(ManOpen)
  const L = F.lt
  const fits = useMemo(() => marketFits(F), [F.year, F.fa?.length, F.off?.step]) // eslint-disable-line react-hooks/exhaustive-deps
  const offers = L.off ?? {}
  const nOff = Object.keys(offers).length
  const setChoice = (x, c) => {
    act(X => {
      const lt = { ...X.lt, fc: { ...(X.lt.fc ?? {}), [x.p.i]: c } }
      if (lt.off?.[x.p.i]) lt.off = { ...lt.off, [x.p.i]: offerFor(X, x, c) }
      X.lt = lt
    })
    haptic('light')
  }
  const toggle = (x, o) => {
    act(X => { const off = { ...(X.lt.off ?? {}) }; if (off[x.p.i]) delete off[x.p.i]; else off[x.p.i] = o; X.lt = { ...X.lt, off } })
    sfx(offers[x.p.i] ? 'swap' : 'claim'); haptic('light')
  }
  const finish = () => { act(X => { lightFA(X) }); sfx('whistle'); haptic('medium'); toTop() }
  return (
    <section className="nb-fa">
      <CapBar F={F} />
      <ResignLines F={F} />
      <Chyron team={F.team} title="Free agency" right={fits.length || null} sub={`THE BEST FITS FOR THE ${nick(F.team).toUpperCase()} · FAIR IS HIS ASK, STRONG IS 10% MORE`} />
      <div className="nl-list">
      {fits.map(x => {
        const { p } = x
        const c = L.fc?.[p.i] ?? { s: 0, y: Math.min(x.ask.y, x.room.y ?? 4) }
        const want = offerFor(F, x, c)
        const out = offers[p.i]
        const o = out ?? want
        const [word, tone] = CHANCE[offerChance(F, p.i, o)]
        const capped = o.$ < x.ask.$ * (c.s ? 1.1 : 1) - 0.05
        const was = p.was ?? p.fr
        const sheet = !!(p.rfa && p.fr && p.fr !== F.team && !p.rn)
        const maxY = x.room.y ?? 4
        const pick = v => setChoice(x, { ...c, ...v })
        return (
          <div key={p.i} className={`lt-pick${out ? ' is-out' : ''}`}>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={was && TEAM[was] ? was : F.team} size="s" line={[`AGE ${p.ag}`, x.role >= 1 ? 'WOULD START' : x.role >= 0.5 ? 'ROTATION' : 'DEPTH', sheet ? `RFA · ${TEAM[p.fr].short} CAN MATCH` : null].filter(Boolean).join(' · ')} onClick={open ? () => { open(p.i); sfx('tap') } : undefined} />
            <div className="lt-terms">
              <div className="lt-seg" role="radiogroup" aria-label={`Offer to ${p.n}`}>
                <button type="button" role="radio" aria-checked={!c.s} className={!c.s ? 'is-on' : ''} onClick={() => { if (c.s) { pick({ s: 0 }); sfx('tap') } }}>Fair</button>
                <button type="button" role="radio" aria-checked={!!c.s} className={c.s ? 'is-on' : ''} disabled={!c.s && x.room.$ <= x.ask.$ + 0.05} onClick={() => { if (!c.s) { pick({ s: 1 }); sfx('tap') } }}>Strong</button>
              </div>
              <div className="nl-step" role="group" aria-label={`Years for ${p.n}`}>
                <button type="button" aria-label="Fewer years" disabled={c.y <= 1} onClick={() => { pick({ y: c.y - 1 }); sfx('tap') }}>−</button>
                <b>{yrs(c.y)}</b>
                <button type="button" aria-label="More years" disabled={c.y >= maxY} onClick={() => { pick({ y: c.y + 1 }); sfx('tap') }}>+</button>
              </div>
            </div>
            {capped && <p className="lt-odds">{`The most the ${nick(F.team)} can offer him now.`}</p>}
            <button type="button" className={`lt-offer${out ? ' is-on' : ''} is-${tone}`} onClick={() => toggle(x, want)} aria-pressed={!!out}>
              <b>{out ? 'Offer made' : sheet ? 'Offer sheet' : 'Offer'}</b><small>{word}</small><span>{money(o.$)} · {yrs(o.y)}</span>
            </button>
          </div>
        )
      })}
      </div>
      {!fits.length && <p className="nbo-note">{`Nobody on the market fits under the ${nick(F.team)} cap and exceptions now. Minimum deals are at camp.`}</p>}
      <p className="nbo-note">Other teams bid too. Each man signs where the offer adds up best for him: the money, the years, a winner, a role. Every offer is checked against the cap when he decides.</p>
      <ActionBar><Go onClick={finish} sub={nOff ? `${nOff} ${nOff === 1 ? 'OFFER' : 'OFFERS'}` : 'NO OFFERS'}>Finish free agency</Go></ActionBar>
    </section>
  )
}
// the re-sign calls, as made (the market's screens)
function ResignLines({ F }) {
  const r = F.lt?.rsr ?? []
  if (!r.length) return null
  const line = ([id, k, why]) => {
    const p = manOf(F, id)
    const n = p?.n ?? ''
    if (k === 'kept') return p ? `${n} re-signs: ${money(p.$)} a season for ${p.y} ${p.y === 1 ? 'year' : 'years'}.` : null
    if (k === 'qo') return `${n} is a restricted free agent: his qualifying offer is tendered.`
    if (why) return `${n} couldn't be kept (${String(why).replace(/\.$/, '').toLowerCase()}) and is a free agent.`
    return null
  }
  const rows = r.map(x => [x, line(x)]).filter(x => x[1])
  const gone = r.filter(x => x[1] === 'gone' && !x[2]).length
  return (
    <section className="lt-sec">
      <h3 className="fh-h"><b>Re-sign</b><span>{`${r.filter(x => x[1] === 'kept').length} kept · ${gone} let go`}</span></h3>
      {rows.map(([x, t]) => <p key={x[0]} className="lt-line">{t}</p>)}
    </section>
  )
}
const FA_K = { won: 'SIGNED', lost: null, open: 'STILL UNSIGNED', cap: 'NO CAP ROOM' }
function MarketDone({ F, act, owner }) {
  const open = useContext(ManOpen)
  const tap = id => tapMan(open, F, id)
  const L = F.lt ?? {}
  const res = L.far ?? []
  const mine = (F.off?.wire ?? []).filter(x => x[2] === F.team && teamOfMan(F, x[1]) === F.team).map(x => manOf(F, x[1])).filter(Boolean)
  const big = bigDeals(F)
  const sheets = sheetNews(F)
  const go = () => { act(X => { lightCamp(X) }); sfx('whistle'); haptic('medium'); toTop() }
  return (
    <section className="nb-fa">
      <Chyron team={F.team} title="Free agency" tag="CLOSED" sub={`${mine.length} ${mine.length === 1 ? 'SIGNING' : 'SIGNINGS'} FOR THE ${nick(F.team).toUpperCase()} · SIX DAYS PLAYED`} />
      <ResignLines F={F} />
      <section className="lt-sec">
        <h3 className="fh-h"><b>{`The ${nick(F.team)} offers`}</b><span>{res.length || 'None'}</span></h3>
        {res.length ? (
          <ol className="nbo-dev-list">
            {res.map(x => (
              <li key={x.i} className={x.k === 'won' ? 'is-me' : ''} style={x.s ? fkVars(x.s) : undefined} {...tap(x.i)}>
                {x.s ? <KLogo s={x.s} size={20} /> : <i className="nbo-nologo" />}
                <span><b>{x.n}</b><small>{x.k === 'lost' ? `CHOSE THE ${TEAM[x.s].nick.toUpperCase()}` : FA_K[x.k]}</small></span>
                <em>{x.$ ? `${money(x.$)} × ${x.y}` : ''}</em>
              </li>
            ))}
          </ol>
        ) : <p className="lt-line">{`The ${nick(F.team)} made no offers.`}</p>}
      </section>
      {sheets.length > 0 && <section className="lt-sec">{sheets.map(x => <p key={x.text} className="lt-line">{x.text}</p>)}</section>}
      {mine.length > 0 && <KeptList F={F} kept={mine} title="Signed" />}
      {big.length > 0 && (
        <section className="lt-sec">
          <h3 className="fh-h"><b>Around the league</b><span>The biggest deals</span></h3>
          <ol className="nbo-dev-list">
            {big.map(d => <li key={d.p.i} style={fkVars(d.s)} {...tap(d.p.i)}><KLogo s={d.s} size={20} /><span><b>{d.p.n}</b><small>{`${TEAM[d.s].short} · ${d.p.p} · OVR ${d.p.o}`}</small></span><em>{`${money(d.$)} × ${d.y}`}</em></li>)}
          </ol>
        </section>
      )}
      <ActionBar><Go onClick={go}>Next: Training camp</Go></ActionBar>
    </section>
  )
}

// ── 3. CAMP: the front office's cuts, when the roster is past 15 ────────────
function CampCalls({ F, act }) {
  const ids = campCuts(F)
  if (!ids.length) return null
  const men = ids.map(i => F.teams[F.team].r.find(p => p.i === i)).filter(Boolean)
  const dead = men.reduce((a, p) => a + (CAP_SIM.cutCost(F, p)?.total ?? 0), 0)
  const cut = () => { act(X => { for (const id of ids) { const p = X.teams[X.team].r.find(m => m.i === id); CAP_SIM.cutMan(X, X.team, id); if (p) addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived ${p.n}` }) } }); sfx('deny'); haptic('medium') }
  return (
    <section className="lt-sec nl-cuts">
      <Chyron team={F.team} size="s" title="The front office's cuts" sub={dead > 0.05 ? `${money(dead)} IN DEAD MONEY` : 'NO DEAD MONEY'} />
      <p className="lt-line">{`To get to 15: waive ${men.map(p => `${p.n} (${p.o})`).join(', ')}. Or pick the men to waive below.`}</p>
      <Go ghost onClick={cut}>{`Waive ${men.length === 1 ? 'him' : `these ${men.length}`}`}</Go>
    </section>
  )
}
