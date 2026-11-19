import { useMemo, useState } from 'react'
import {
  TEAM, recText, mySchedule, DIV_OF, CONF_OF, REG_WEEKS, FINISH_TEXT, coyRec, optionDue, startsFor, resignAsk, optionAsk,
  marketDeals, callerOf, staffMen, moveText, statLine, standingOf, fitOf,
} from '../../lib/franchise2'
import {
  STRETCH, stretchText, stretchRecap, lightNext, lightStep, lightStaff, lightRoom, lightView, marketFits, fairOffer, lightFA, lightOpenDraft,
  callOf, staffMoves, canKeep, canOffer, keepTerms, canTerms, yesChance, offerFor,
} from '../../lib/franchise2/light'
import { lineOf } from '../../lib/franchise2/season'
import { romanOf } from '../../lib/mg/kit'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, KLogo, ManL3, BigRec, BigNum, Go, Tag, ActionBar, Fold, fkVars, Scorebug, Stamp } from './kit'
import { Man, CapBar, PlayerPage, money } from './dparts'
import { StaffL3 } from './Staff'
import { DayResults, CampReport } from './Deals'
import { Step } from './dealbits'
import { DraftDay } from './Draft'
import { GameBoxSheet } from './Week'
import { recordsOf, standingsOf, revOf } from './perf'
import { spotOf } from '../../lib/franchise2/news'
import './light.css'

// FRANCHISE LIGHT's own screens (engine: lib/franchise2/light.js). LIGHT never goes into a game: every week and every
// playoff round is simmed, each result with its box score. The rest is FULL's: the event card, the playoff card and
// bracket, the Team, League and History tabs, the draft's board and pick screens.
//   StretchCard     the season card: the stretch's six opponents, PLAY WEEKS 1–6
//   RoundResult     the player's last playoff game: the final, the line under it, its box score
//   StretchRecap    the stretch played: the results (each one's box score), the builds' lines, the standings, who
//                   got hurt, the wire, and the one button on
//   LightOffseason  the offseason's three steps: STAFF & AWARDS → ROSTER → DRAFT
const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const nick = s => TEAM[s]?.nick ?? s
const NICK = s => nick(s).toUpperCase()
const favText = l => (l.fav ? `${TEAM[l.fav].nick} favored by ${l.pts}` : 'Even game')
const yrs = y => `${y} ${y === 1 ? 'YR' : 'YRS'}`

// ═════════════════════════════════════════════════════════════════════════════
// THE SEASON
// ═════════════════════════════════════════════════════════════════════════════
// the stretch's six opponents, one line each: the week, home or away, the team, its record and the line
export function StretchCard({ F, play, simToEnd }) {
  const L = F.lt
  const R = recordsOf(F), S = standingsOf(F)
  const sch = mySchedule(F).slice(L.w0, L.w1)
  const placeOf = s => { const d = DIV_OF[s], r = S.R?.[s]; return r && r.w + r.l + r.t > 0 ? `${ORD(S.div[d].indexOf(s) + 1)} ${d}` : d }
  return (
    <section className="fh-next lt-card">
      <div className="fh-next-h"><b>{stretchText(L.k)}</b><span>Stretch {L.k + 1} of 3</span></div>
      <div className="lt-opps" role="list" aria-label="The stretch's opponents">
        {sch.map(g => {
          if (g.bye) return <div key={g.wk} role="listitem" className="lt-opp is-bye"><span className="lt-opp-wk">Wk {g.wk}</span><b>Bye week</b></div>
          const a = g.home ? g.opp : F.team, h = g.home ? F.team : g.opp
          const div = DIV_OF[g.opp] === DIV_OF[F.team]
          return (
            <div key={g.wk} role="listitem" className="lt-opp" style={fkVars(g.opp)}>
              <span className="lt-opp-wk">Wk {g.wk}</span>
              <span className="lt-opp-t"><i>{g.home ? 'vs' : '@'}</i><KLogo s={g.opp} size={26} /><b>{TEAM[g.opp].nick}</b>{div && <em>DIV</em>}</span>
              <span className="lt-opp-rec"><b>{recText(R[g.opp])}</b><small>{placeOf(g.opp)}</small></span>
              <span className="lt-opp-line">{favText(lineOf(F, a, h))}</span>
            </div>
          )
        })}
      </div>
      <p className="fh-next-note">All six weeks are simmed. Every result comes with its box score.</p>
      <div className="fh-go">
        <Go onClick={play}>Play {stretchText(L.k)}</Go>
        {F.wk < REG_WEEKS - 1 && <button type="button" className="fh-textbtn" onClick={simToEnd}>Sim to the playoffs</button>}
      </div>
    </section>
  )
}

// ── A playoff round's result (LIGHT sims the round: Hub.jsx PlayoffCard and Champions) ─────────
const PO_ROUND = ['Wild card round', 'Divisional round', null, null]
export function RoundResult({ F, owner }) {
  const [box, setBox] = useState(false)
  const g = [...(F.log ?? [])].reverse().find(r => r.rd != null)
  if (!g) return null
  const a = g.home ? g.opp : F.team, h = g.home ? F.team : g.opp
  const as = g.home ? g.them : g.us, hs = g.home ? g.us : g.them
  const name = g.rd === 3 ? `Super Bowl ${romanOf(F.year - 1965)}` : g.rd === 2 ? `${CONF_OF[F.team]} Championship` : PO_ROUND[g.rd]
  const res = g.w ? 'w' : g.t ? 't' : 'l'
  return (
    <section className="fh-next lt-round">
      <div className="fh-next-h"><b>{name}</b><span>Final{g.ot ? ' · OT' : ''}</span></div>
      <Scorebug a={a} h={h} as={as} hs={hs} final={g.ot ? 'F/OT' : 'FINAL'} label={g.rd === 3 ? 'SB' : ['WC', 'DIV', 'CONF'][g.rd]} />
      <div className="lt-round-hl"><Stamp kind={res} delay={200}>{res === 'w' ? 'WIN' : res === 't' ? 'TIE' : 'LOSS'}</Stamp><span><b>{g.hl}</b>{g.sub && <small>{g.sub}</small>}</span></div>
      {g.bx && <button type="button" className="fh-textbtn" onClick={() => { setBox(true); sfx('tap') }}>Box score</button>}
      {box && <GameBoxSheet F={F} row={g} owner={owner} portal onClose={() => setBox(false)} />}
    </section>
  )
}

// ── The stretch's recap ──────────────────────────────────────────────────────
function hurtText(x) {
  const what = x.what ? ` (${x.what})` : ''
  return `${x.n}${what} · ${x.se ? 'out for the season' : x.wk >= 4 ? `injured reserve, ${x.wk} weeks` : `out ${x.wk} ${x.wk === 1 ? 'week' : 'weeks'}`}`
}
export function StretchRecap({ F, act, owner, onPlayoffs }) {
  const L = F.lt
  const X = useMemo(() => stretchRecap(F), [F, revOf(F)]) // eslint-disable-line react-hooks/exhaustive-deps
  const [box, setBox] = useState(null)
  if (!X) return null
  const last = L.k === 2
  const c = CONF_OF[F.team], div = DIV_OF[F.team]
  const next = () => {
    const r = act(X2 => lightNext(X2))
    sfx('whistle'); haptic('medium')
    if (r?.playoffs === false) onPlayoffs?.()
    try { document.querySelector('.fh-scroll')?.scrollTo(0, 0) } catch { /* (no scroll box) */ }
  }
  const S = standingsOf(F)
  return (
    <section className="fh-next lt-recap">
      {/* (owner 11-18: it read confusing. The stretch named once, then three plain facts: these weeks, the season,
          the division; the bye in its week's place) */}
      <div className="fh-next-h"><b>{stretchText(L.k)}</b>{last && <span>Regular season final</span>}</div>
      <div className="lt-rec">
        {/* (the season's record first and biggest, these weeks beside it: owner 11-18) */}
        <BigRec w={X.rec.w} l={X.rec.l} t={X.rec.t} size={64} label="SEASON" />
        <span className="lt-rec-all"><b>{recText({ w: X.w, l: X.l, t: X.t })}</b><small>These weeks</small></span>
        <span className="lt-rec-all"><b>{ORD(X.place)}</b><small>{div}</small></span>
      </div>
      <div className="lt-games" role="list">
        {mySchedule(F).filter(g => g.bye && g.wk > STRETCH[L.k][0] && g.wk <= STRETCH[L.k][1]).map(g => (
          <div key={`bye-${g.wk}`} role="listitem" className="lt-game is-bye" style={{ order: g.wk }}>
            <span className="lt-game-wk">Wk {g.wk}</span>
            <span className="lt-game-opp"><b>Bye week</b></span>
          </div>
        ))}
        {X.rows.map(r => (
          <button key={r.wk} type="button" role="listitem" className={`lt-game is-${r.w ? 'w' : r.t ? 't' : 'l'}`} style={{ ...fkVars(r.opp), order: r.wk }} onClick={() => { if (r.bx) { setBox(r); sfx('tap') } }} disabled={!r.bx} aria-label={`Week ${r.wk}: ${r.hl}. Box score`}>
            <span className="lt-game-wk">Wk {r.wk}</span>
            <span className="lt-game-opp"><i>{r.home ? 'vs' : '@'}</i><KLogo s={r.opp} size={24} /><b>{TEAM[r.opp].short}</b></span>
            <span className="lt-game-sc"><b>{r.w ? 'W' : r.t ? 'T' : 'L'} {r.us}-{r.them}{r.ot ? ' OT' : ''}</b><small>{r.sub || r.hl}</small></span>
            {r.bx && <i className="lt-game-go" aria-hidden="true">›</i>}
          </button>
        ))}
      </div>
      {X.builds.length > 0 && (
        <div className="lt-sec">
          <h3 className="fh-h"><b>{owner}'s builds</b><span>{stretchText(L.k)}</span></h3>
          {X.builds.map((b, i) => (
            <div key={b.p.i} className="lt-aw">
              <ManL3 F={F} p={b.p} team={F.team} owner={owner} size="s" delay={i * 40} line={b.gp ? `${b.gp} ${b.gp === 1 ? 'GAME' : 'GAMES'}` : 'DID NOT PLAY'} />
              {b.line && <span className="lt-aw-line">{b.line}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="lt-sec">
        <h3 className="fh-h"><b>{div}</b><span>{c}: {ORD(X.conf)}{X.seed ? ` · ${ORD(X.seed)} seed` : ' · outside the seven'}</span></h3>
        {X.div.map((s, i) => (
          <div key={s} className={`fh-rung${s === F.team ? ' is-me' : ''}`} style={fkVars(s)}>
            <i>{i + 1}</i><KLogo s={s} size={28} /><b>{TEAM[s].nick}</b><span>{recText(S.R[s])}</span>
          </div>
        ))}
      </div>
      <div className="lt-sec">
        <h3 className="fh-h"><b>Injuries</b><span>{X.hurt.length ? `${X.hurt.length} ${TEAM[F.team].nick}` : 'None'}</span></h3>
        {X.hurt.length ? X.hurt.map(x => <p key={`${x.id}-${x.at}`} className="lt-line is-inj">{hurtText(x)}</p>) : <p className="lt-line">{`Nobody on the ${TEAM[F.team].nick} was hurt in these weeks.`}</p>}
      </div>
      {X.wire.length > 0 && (
        <div className="lt-sec">
          <h3 className="fh-h"><b>Around the league</b></h3>
          {X.wire.map(x => <p key={x.text} className="lt-line lt-wire" style={fkVars(x.s)}>{x.s && <KLogo s={x.s} size={20} />}<span>{x.text}</span></p>)}
        </div>
      )}
      <ActionBar><Go onClick={next}>{last ? (X.seed ? 'On to the playoffs' : 'Finish the season') : `Next: ${stretchText(L.k + 1)}`}</Go></ActionBar>
      {box && <GameBoxSheet F={F} row={box} owner={owner} portal onClose={() => setBox(null)} />}
    </section>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// THE OFFSEASON: three steps
// ═════════════════════════════════════════════════════════════════════════════
const STEPS = ['Staff & awards', 'Roster', 'Draft']
export function LightOffseason({ F, act, owner, onBuild }) {
  const i = lightStep(F)
  return (
    <div className="fd fk fd-off lt-off">
      <nav className="fd-stops lt-stops" aria-label="Offseason steps">
        <span className="fd-stops-h"><b>Offseason</b><small>Step {i + 1} of {STEPS.length}: {STEPS[i]}</small></span>
        <ol>
          {STEPS.map((n, j) => <li key={n} className={j === i ? 'is-on' : j < i ? 'is-done' : ''} aria-current={j === i ? 'step' : undefined}><i>{j < i ? '✓' : j + 1}</i><span>{n}</span></li>)}
        </ol>
      </nav>
      <div className="fd-off-main lt-off-main">
        {i === 0 && <StaffAwards key={`s${F.year}`} F={F} act={act} owner={owner} />}
        {i === 1 && <Roster key={`r${F.year}`} F={F} act={act} owner={owner} />}
        {i === 2 && <DraftDay F={F} act={act} owner={owner} onBuild={onBuild} light />}
      </div>
    </div>
  )
}

// ── 1. STAFF & AWARDS ────────────────────────────────────────────────────────
const AW = [['mvp', 'Most Valuable Player'], ['opoy', 'Offensive Player of the Year'], ['dpoy', 'Defensive Player of the Year'], ['oroy', 'Offensive Rookie of the Year'], ['droy', 'Defensive Rookie of the Year']]
const SPOT = { qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', ot: 'OT', og: 'OG', c: 'C', edge: 'EDGE', dt: 'DT', lb: 'LB', cb: 'CB', s: 'S', k: 'K' }
const AW_CODE = { MVP: 'MVP', OPOY: 'OFFENSIVE PLAYER OF THE YEAR', DPOY: 'DEFENSIVE PLAYER OF THE YEAR', OROY: 'OFFENSIVE ROOKIE OF THE YEAR', DROY: 'DEFENSIVE ROOKIE OF THE YEAR' }
const findMan = (F, w) => (w && F.teams[w.t]?.r.find(x => x.i === w.i)) ?? (w ? { i: w.i, n: w.n, p: w.p, o: 0, b: w.b } : null)
const JOB = { oc: 'OC', dc: 'DC' }
const JOB_LONG = { oc: 'Offensive coordinator', dc: 'Defensive coordinator' }
const callsOf = (F, role) => ['off', 'def'].filter(x => callerOf(F, F.team, x).who === role)
// a side's season in one line (Staff.jsx's Black Monday line): "12TH IN POINTS · 23.4 A GAME"
function unitLine(F, k) {
  const rk = F.car?.ranks?.[F.team]?.[k === 'oc' ? 0 : 1]
  const h = F.hist?.[F.hist.length - 1], g = h ? Math.max(1, h.w + h.l + h.t) : 17
  if (!rk || !h) return null
  return k === 'oc' ? `${ORD(rk).toUpperCase()} IN POINTS · ${(h.pf / g).toFixed(1)} A GAME` : `${ORD(rk).toUpperCase()} IN POINTS ALLOWED`
}
function StaffAwards({ F, act, owner }) {
  const h = F.hist[F.hist.length - 1], aw = F.aw ?? {}
  const [fire, setFire] = useState({ oc: false, dc: false })
  const [all, setAll] = useState(false)
  const [page, setPage] = useState(null)
  const t = F.teams[F.team]
  const M = staffMen(F, F.team)
  const champ = h?.fin === 'champ'
  const ours = (aw.ap ?? []).filter(x => x.t === F.team)
  // the builds' seasons: their lines and their honors (awards.js closeSeason: each build's year on his career)
  const builds = t.r.filter(p => p.b != null).map(p => {
    const c = F.builds[p.b]?.car?.slice(-1)[0]
    const hon = [c?.aw && AW_CODE[c.aw], aw.hon?.[p.i] === 'AP' ? 'ALL-PRO' : aw.hon?.[p.i] === 'PB' ? 'PRO BOWL' : null].filter(Boolean)
    const gp = c?.gp ?? 0
    return { p, hon, gp, line: gp ? statLine(p, { ...(c?.st ?? {}), gp }) : null }
  })
  const gone = (F.car?.ev ?? []).filter(e => e.s === F.team && e.role !== 'hc' && e.k === 'ret')
  const fired = (F.car?.ev ?? []).filter(e => e.role === 'hc' && e.k === 'fire').length
  const go = () => { act(X => lightStaff(X, fire)); sfx('whistle'); haptic('medium'); try { document.querySelector('.fh-scroll')?.scrollTo(0, 0) } catch { /* */ } }
  const flip = (k, v) => { setFire(f => ({ ...f, [k]: v })); sfx(v ? 'stamp' : 'tap') }
  return (
    <>
      <section className="fd-recap" style={fkVars(F.team)}>
        <Chyron team={F.team} tone={champ ? 'gold' : 'team'} title={champ ? 'SUPER BOWL CHAMPIONS' : `${h.y} SEASON`} tag={h.y} sub={champ ? null : FINISH_TEXT[h.fin] ?? ''} />
        <div className="fd-recap-row">
          <BigRec w={h.w} l={h.l} t={h.t} size={64} />
          <span className="fd-recap-facts">
            <BigNum v={h.pf} label="POINTS" size={28} /><BigNum v={h.pa} label="ALLOWED" size={28} />
            {ours.length > 0 && <BigNum v={ours.length} label={ours.length === 1 ? 'ALL-PRO' : 'ALL-PROS'} size={28} />}
          </span>
        </div>
      </section>
      {/* (a wide screen: the season's honors on the left, the coordinators' call on the right; a phone: one column) */}
      <div className="lt-cols">
      <div className="lt-col">
      {builds.length > 0 && (
        <section className="lt-sec">
          <Chyron team={F.team} size="s" title={`${owner}'s builds`} right={h.y} />
          {builds.map(({ p, hon, gp, line }) => (
            <div key={p.i} className="lt-hon">
              <Man F={F} p={p} s={F.team} owner={owner} size="s" line={gp ? `${gp} ${gp === 1 ? 'GAME' : 'GAMES'}` : 'DID NOT PLAY'} onClick={() => setPage(p.i)} />
              {line && <span className="lt-aw-line">{line}</span>}
              {hon.length > 0 && <span className="lt-hon-tags">{hon.map(x => <Tag key={x} tone="gold">{x}</Tag>)}</span>}
            </div>
          ))}
        </section>
      )}
      <section className="lt-sec">
        <Chyron tone="ink" size="s" title="THE AWARDS" right={h.y} />
        {AW.filter(([k]) => aw[k]).map(([k, title]) => {
          const w = aw[k], p = findMan(F, w)
          return (
            <div key={k} className={`lt-aw${w.t === F.team ? ' is-me' : ''}`}>
              <small>{title}</small>
              <Man F={F} p={p} s={w.t} owner={owner} size="m" line={NICK(w.t)} onClick={p?.o ? () => setPage(p.i) : undefined} />
              <span className="lt-aw-line">{w.line}</span>
            </div>
          )
        })}
        {aw.coy && (
          <div className="fd-coy" style={fkVars(aw.coy.t)}>
            <KLogo s={aw.coy.t} size={36} />
            <span><small>COACH OF THE YEAR</small><b>{aw.coy.n}</b><em>{nick(aw.coy.t)} · {coyRec(aw.coy)}</em></span>
          </div>
        )}
        <Chyron tone="ink" size="s" title="ALL-PRO FIRST TEAM" right={<button type="button" className="fd-link" onClick={() => { setAll(x => !x); sfx('tap') }}>{all ? NICK(F.team) : `ALL ${aw.ap?.length ?? 0}`}</button>} />
        {(all ? aw.ap ?? [] : ours).map((x, j) => (
          <div key={`${x.spot}-${x.i}`} className={`fd-ap${x.t === F.team ? ' is-me' : ''}`} style={{ ...fkVars(x.t), '--d': `${Math.min(j, 10) * 25}ms` }}>
            <i>{SPOT[x.spot]}</i><KLogo s={x.t} size={22} /><b>{x.n}</b><small>{x.line}</small>
          </div>
        ))}
        {!all && !ours.length && <div className="fd-none">{`NONE FROM THE ${NICK(F.team)}`}</div>}
      </section>
      </div>
      <div className="lt-col">
      <section className="lt-sec">
        <Chyron team={F.team} size="s" title="BLACK MONDAY" right="KEEP OR FIRE" />
        {['oc', 'dc'].map(k => {
          const c = M[k], g = gone.find(e => e.role === k)
          if (!c) return <p key={k} className="lt-line">{g ? `${JOB_LONG[k]} ${g.n} retires at ${g.ag - 1}.` : `The ${JOB_LONG[k].toLowerCase()} job is open.`} A new one is hired from the league's short list.</p>
          return (
            <div key={k} className={`lt-keep${fire[k] ? ' is-fire' : ''}`}>
              <StaffL3 F={F} c={c} role={k} team={F.team} size="s" full={false} calls={callsOf(F, k)} line={unitLine(F, k) ?? `SINCE ${c.st ?? F.year}`} />
              <div className="lt-seg" role="radiogroup" aria-label={`${JOB_LONG[k]} ${c.n}`}>
                <button type="button" role="radio" aria-checked={!fire[k]} className={!fire[k] ? 'is-on' : ''} onClick={() => flip(k, false)}>Keep {JOB[k]}</button>
                <button type="button" role="radio" aria-checked={!!fire[k]} className={fire[k] ? 'is-on is-fire' : ''} onClick={() => flip(k, true)}>Fire {JOB[k]}</button>
              </div>
            </div>
          )
        })}
        <p className="fst-note">A fired coordinator is replaced by the best man on the league's short list who takes the job. {fired ? `Around the league, ${fired} head ${fired === 1 ? 'coach was' : 'coaches were'} fired today.` : 'Every head coach around the league kept his job.'}</p>
      </section>
      </div>
      </div>
      <ActionBar><Go onClick={go}>Next: Roster</Go></ActionBar>
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}

// ── 2. ROSTER: re-sign, then the market ─────────────────────────────────────
const STAND = { short: () => ['UNDER HIS NUMBER', 'l'], alone: () => ['ONLY OFFER', 'w'], lead: F => [`${NICK(F.team)} LEAD`, 'w'], close: () => ['TOO CLOSE TO CALL', 'n'], behind: (F, s) => [`${NICK(s.lead)} LEAD`, 'l'] }
const FIT_TEXT = { hole: 'FILLS A HOLE', start: 'WOULD START', depth: 'DEPTH' }
// a résumé line in a sentence's case: "BILLS QB COACH" → "Bills QB Coach", "OHIO STATE DC" → "Ohio State DC"
const KEEP_CAPS = new Set(['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'OC', 'DC', 'HC', 'NFL', 'LSU', 'USC', 'SMU', 'BYU', 'TCU', 'UCLA', 'A&M'])
const titleOf = s => String(s).split(' ').map(w => (KEEP_CAPS.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ')
// the staff's moves this offseason, one line each (the wire's words: carousel.js moveText)
function StaffLines({ F }) {
  const list = staffMoves(F)
  if (!list.length) return null
  return (
    <section className="lt-sec">
      <h3 className="fh-h"><b>The staff</b><span>{F.year + 1}</span></h3>
      {list.map((e, i) => <p key={`${e.k}-${e.id}-${i}`} className="lt-line lt-wire" style={fkVars(e.k === 'leave' ? e.to : e.s)}><KLogo s={e.k === 'leave' ? e.to : e.s} size={20} /><span>{moveText(F, e)}{e.k === 'hire' && e.was ? `, from ${titleOf(e.was)}` : ''}</span></p>)}
    </section>
  )
}
function Roster({ F, act, owner }) {
  const [page, setPage] = useState(null)
  const rev = revOf(F)
  if (!F.fad) return <RosterDone F={F} act={act} owner={owner} />
  return <RosterOpen F={F} act={act} owner={owner} rev={rev} page={page} setPage={setPage} />
}
function RosterOpen({ F, act, owner, rev, page, setPage }) {
  const t = F.teams[F.team]
  const men = (F.rs ?? []).map(i => t.r.find(x => x.i === i)).filter(Boolean)
  const callsKey = JSON.stringify(F.lt?.rs ?? {})
  const V = useMemo(() => lightView(F), [callsKey, F.fa?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const L = F.lt ?? {}
  // (the men who turned down less to stay: on the market now, first on the list, the player can still make an offer)
  const back = Object.entries(L.rsx ?? {}).filter(([, x]) => !x[0]).map(([i]) => (F.fa ?? []).find(p => p.i === +i)).filter(Boolean)
  const fits = useMemo(() => {
    const ids = new Set(back.map(p => p.i))
    return [...back.map(p => ({ p, fit: fitOf(F, p, V), back: true })), ...marketFits(F, V).filter(x => !ids.has(x.p.i))].map(x => ({ ...x, fair: fairOffer(F, x.p, V) }))
  }, [V, back.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const room = lightRoom(F)
  void rev
  const setCall = (p, c) => { act(X => { X.lt = { ...(X.lt ?? {}), rs: { ...(X.lt?.rs ?? {}), [p.i]: c } } }); sfx(c === false || c === 'decline' ? 'swap' : 'claim') }
  // a man kept: his price (his ask, 5% or 10% under) and his years
  const setTerms = (p, t) => { act(X => { X.lt = { ...(X.lt ?? {}), tm: { ...(X.lt?.tm ?? {}), [p.i]: t } } }); haptic('light') }
  const offers = L.off ?? {}
  const toggleOffer = (p, o) => {
    act(X => { const off = { ...(X.lt?.off ?? {}) }; if (off[p.i]) delete off[p.i]; else off[p.i] = o; X.lt = { ...(X.lt ?? {}), off } })
    sfx(offers[p.i] ? 'swap' : 'claim'); haptic('light')
  }
  // an offer's price (Fair or Strong) and years; an offer already out changes with it
  const setChoice = (p, fair, c) => {
    act(X => {
      const lt = { ...(X.lt ?? {}), fc: { ...(X.lt?.fc ?? {}), [p.i]: c } }
      if (lt.off?.[p.i]) lt.off = { ...lt.off, [p.i]: offerFor(X, p, fair, c) }
      X.lt = lt
    })
    haptic('light')
  }
  const finish = () => { act(X => lightFA(X)); sfx('whistle'); haptic('medium'); try { document.querySelector('.fh-scroll')?.scrollTo(0, 0) } catch { /* */ } }
  const over = room.left < -1e-9 && room.spend > 0
  const nOff = Object.keys(offers).length
  return (
    <>
      <StaffLines F={F} />
      <CapBar F={F} extra={Math.round((room.room - room.left) * 10) / 10} />
      <div className="lt-roster">
        <section className="lt-sec">
          <Chyron team={F.team} size="s" title="RE-SIGN" right={men.length || null} sub={L.rsDone ? 'THE CALLS ARE MADE' : men.length ? 'SET TO THE FRONT OFFICE’S CALL · CHANGE ANY OF THEM' : 'NO DEALS ARE UP'} />
          {L.rsDone && <ResignLines F={F} />}
          {men.some(p => p.b == null && callOf(F, p) !== true && callOf(F, p) !== 'option' && !canKeep(F, p, optionDue(p) ? 'option' : true)) && (
            <p className="lt-line">{`The ${nick(F.team)} have ${money(Math.max(0, room.left))} in cap room. A release on a player's card clears room under the cap.`}</p>
          )}
          {men.map(p => {
            const c = callOf(F, p), opt = optionDue(p)
            const ask = opt ? null : keepTerms(F, p)
            const keep = opt ? c === 'option' : c === true
            const fits = keep || canKeep(F, p, opt ? 'option' : true)
            return (
              <div key={p.i} className={`lt-pick${keep ? '' : ' is-off'}`}>
                <Man F={F} p={p} s={F.team} owner={owner} size="s" line={`AGE ${p.ag} · ${opt ? 'FIFTH-YEAR OPTION' : startsFor(F, p) ? 'STARTER' : 'BACKUP'}`} onClick={() => setPage(p.i)} />
                <div className="lt-seg" role="radiogroup" aria-label={p.n}>
                  <button type="button" role="radio" aria-checked={keep} className={keep ? 'is-on' : ''} disabled={!fits} onClick={() => !keep && setCall(p, opt ? 'option' : true)}>
                    <span>{opt ? 'Pick up' : fits ? 'Keep' : 'No cap room'}</span><small>{opt ? `${money(optionAsk(p, F))} in ${F.year + 2}` : `${money(ask.$)} · ${yrs(ask.y)}`}</small>
                  </button>
                  <button type="button" role="radio" aria-checked={!keep} className={!keep ? 'is-on' : ''} onClick={() => keep && setCall(p, opt ? 'decline' : false)}><span>{opt ? 'Decline' : 'Let go'}</span></button>
                </div>
                {keep && !opt && <KeepTerms F={F} p={p} set={t => setTerms(p, t)} />}
                {!keep && p.b != null && <p className="lt-warn">{p.n} leaves the team if he isn't re-signed.</p>}
              </div>
            )
          })}
        </section>
        <section className="lt-sec">
          <Chyron team={F.team} size="s" title="FREE AGENCY" right={fits.length || null} sub={`THE BEST FITS FOR THE ${NICK(F.team)} · FAIR IS THE MARKET'S PRICE, STRONG IS 10% MORE`} />
          {fits.map(({ p, fit, fair, back: was }) => {
            const out = offers[p.i]
            const c = L.fc?.[p.i] ?? { s: 0, y: fair.o.y }
            const want = offerFor(F, p, fair.o, c)
            const o = out ?? want
            const st = o === fair.o ? fair.st : standingOf(F, p, o, V)
            const [word, tone] = STAND[st.k](F, st)
            const can = !!out || canOffer(F, p, o)
            const pick = x => setChoice(p, fair.o, { ...c, ...x })
            return (
              <div key={p.i} className={`lt-pick${out ? ' is-out' : ''}`}>
                <Man F={F} p={p} s={F.team} owner={owner} size="s" line={was ? `AGE ${p.ag} · TURNED IT DOWN` : `AGE ${p.ag} · ${fit.k === 'depth' && p.p === 'k' ? 'CAMP BATTLE' : FIT_TEXT[fit.k]}${fit.k === 'start' ? ` +${fit.d}` : ''}`} onClick={() => setPage(p.i)} />
                <div className="lt-terms">
                  <div className="lt-seg" role="radiogroup" aria-label={`Offer to ${p.n}`}>
                    <button type="button" role="radio" aria-checked={!c.s} className={!c.s ? 'is-on' : ''} onClick={() => { if (c.s) { pick({ s: 0 }); sfx('tap') } }}>Fair</button>
                    <button type="button" role="radio" aria-checked={!!c.s} className={c.s ? 'is-on' : ''} onClick={() => { if (!c.s) { pick({ s: 1 }); sfx('tap') } }}>Strong</button>
                  </div>
                  <Step className="lt-step" label={`Years for ${p.n}`} text={yrs(c.y)} onDown={() => pick({ y: c.y - 1 })} onUp={() => pick({ y: c.y + 1 })} downOk={c.y > 1} upOk={c.y < 5} />
                </div>
                <button type="button" className={`lt-offer${out ? ' is-on' : ''} is-${tone}`} disabled={!can} onClick={() => toggleOffer(p, want)} aria-pressed={!!out}>
                  <b>{out ? 'Offer made' : can ? 'Offer' : 'No cap room'}</b><small>{word}</small><span>{money(o.$)} · {yrs(o.y)}</span>
                </button>
              </div>
            )
          })}
          {!fits.length && <div className="fd-none">NOBODY ON THE MARKET FITS</div>}
          <p className="fst-note">Other teams bid too. Each player signs where the offer adds up best for him.</p>
        </section>
      </div>
      {/* (open, no toggle: owner 11-18) */}
      <CampReport F={F} owner={owner} onMan={setPage} />
      <ActionBar>
        <Go onClick={finish} disabled={over} sub={over ? 'OVER THE CAP' : nOff ? `${nOff} ${nOff === 1 ? 'OFFER' : 'OFFERS'}` : null}>Finish free agency</Go>
      </ActionBar>
      {page != null && <PlayerPage F={F} id={page} owner={owner} act={act} onClose={() => setPage(null)} />}
    </>
  )
}
// A man kept: his price (his ask, or 5% or 10% under it) and his years, one row; under it, how it's likely to go
const CUT_TEXT = ['HIS ASK', '5% UNDER', '10% UNDER']
function KeepTerms({ F, p, set }) {
  const k = keepTerms(F, p), t = F.lt?.tm?.[p.i] ?? { d: 0, y: k.ask.y }
  const ok = x => canTerms(F, p, { ...t, ...x })
  const ch = yesChance(F, p, k.d)
  return (
    <>
      <div className={`lt-terms${p.b != null ? ' is-one' : ''}`}>
        {p.b == null && <Step className="lt-step" label={`Price for ${p.n}`} text={money(k.$)} sub={CUT_TEXT[k.d]} onDown={() => set({ ...t, d: k.d + 1 })} onUp={() => set({ ...t, d: k.d - 1 })} downOk={k.d < 2} upOk={k.d > 0} />}
        <Step className="lt-step" label={`Years for ${p.n}`} text={yrs(k.y)} sub={k.y === k.ask.y ? 'HIS TERM' : k.y > k.ask.y ? 'LONGER' : 'SHORTER'} onDown={() => set({ ...t, y: k.y - 1 })} onUp={() => set({ ...t, y: k.y + 1 })} downOk={k.y > 1 && ok({ y: k.y - 1 })} upOk={k.y < 5 && ok({ y: k.y + 1 })} />
      </div>
      {k.d > 0 && <p className={`lt-odds is-${ch >= 0.6 ? 'w' : ch >= 0.4 ? 'n' : 'l'}`}>{ch >= 0.6 ? 'He will probably take it.' : ch >= 0.4 ? 'It could go either way.' : 'He will probably turn it down.'} If he says no, he goes to free agency.</p>}
    </>
  )
}
// who took less to stay and who turned it down, the way a beat writer would put it (after the market: where he went)
function rsText(F, p, x) {
  const n = p.n
  if (x[0]) return `${n} agreed to stay at ${money(x[1])} a year for ${x[2]} ${x[2] === 1 ? 'year' : 'years'}, under his asking price.`
  const turned = `${n} turned down ${money(x[1])} a year`
  const went = (F.fas ?? []).find(d => d[0] === p.i)
  if (went) return went[3] === F.team ? `${turned}, then came back to the ${nick(F.team)} at ${money(went[4])} a year.` : `${turned} and signed with the ${nick(went[3])}, ${money(went[4])} a year for ${went[5]} ${went[5] === 1 ? 'year' : 'years'}.`
  return F.fad ? `${turned} and will test free agency.` : `${turned} and is still unsigned.`
}
function ResignLines({ F }) {
  const x = F.lt?.rsx ?? {}
  const all = [...F.teams[F.team].r, ...(F.fa ?? []), ...Object.values(F.teams).flatMap(t => t.r)]
  const rows = Object.entries(x).map(([i, v]) => [all.find(p => p.i === +i) ?? { i: +i, n: (F.rsd ?? []).find(r => r[0] === +i)?.[2] ?? '' }, v])
  if (!rows.length) return null
  return rows.map(([p, v]) => <p key={p.i} className={`lt-line${v[0] || F.teams[F.team].r.some(x => x.i === p.i) ? '' : ' is-inj'}`}>{rsText(F, p, v)}</p>)
}
const DONE_TEXT = { kept: 'RE-SIGNED', option: 'OPTION PICKED UP', decline: 'OPTION DECLINED', tag: 'FRANCHISE TAG', gone: 'LET GO' }
function RosterDone({ F, act, owner }) {
  const [page, setPage] = useState(null)
  const L = F.lt ?? {}
  const t = F.teams[F.team]
  const res = L.far ?? []
  const deals = marketDeals(F)
  const mine = deals.filter(d => d.s === F.team)
  const big = deals.filter(d => d.s !== F.team).sort((a, b) => b.$ - a.$).slice(0, 5)
  const rsd = F.rsd ?? []
  const go = () => { act(X => lightOpenDraft(X)); sfx('whistle'); haptic('medium'); try { document.querySelector('.fh-scroll')?.scrollTo(0, 0) } catch { /* */ } }
  return (
    <>
      <Chyron team={F.team} title="FREE AGENCY" tag="CLOSED" sub={`${mine.length} ${mine.length === 1 ? 'SIGNING' : 'SIGNINGS'} FOR THE ${NICK(F.team)} · THE MARKET IS CLOSED`} />
      {res.length > 0 ? <DayResults F={F} r={{ d: null, list: res }} title={`THE ${NICK(F.team)} OFFERS`} /> : <p className="lt-line">{`The ${nick(F.team)} made no offers.`}</p>}
      {rsd.length > 0 && (
        <section className="lt-sec">
          <Chyron tone="ink" size="s" title="RE-SIGN" right={rsd.length} />
          <ResignLines F={F} />
          {rsd.map(([i, k, n]) => {
            const p = t.r.find(x => x.i === i)
            // (a man who went to the market and signed back with the team: his new deal, not LET GO)
            const back = p && k === 'gone'
            const terms = p && (k === 'kept' || k === 'option' || back) ? ` · ${money(k === 'option' ? p.ox ?? p.$ : p.$)} · ${yrs(k === 'option' ? 1 : p.y)}` : ''
            return p ? <Man key={i} F={F} p={p} s={F.team} owner={owner} size="s" line={`${back ? 'SIGNED BACK' : DONE_TEXT[k] ?? k}${terms}`} onClick={() => setPage(p.i)} />
              : <div key={i} className="dl-gone"><b>{n}</b><Tag tone="ink">{L.rsx?.[i]?.[0] === 0 ? 'TURNED IT DOWN' : DONE_TEXT[k] ?? k}</Tag></div>
          })}
        </section>
      )}
      {big.length > 0 && (
        <section className="lt-sec">
          <Chyron tone="ink" size="s" title="AROUND THE LEAGUE" sub="THE BIGGEST DEALS" />
          {big.map(d => (
            <div key={d.i} className="fd-wire-deal" style={fkVars(d.s)}>
              <KLogo s={d.s} size={24} />
              <span><b>{d.n}</b><small>{NICK(d.s)} · {spotOf(F, d)} · {yrs(d.y)}, {money(d.$ * d.y)}</small></span>
            </div>
          ))}
        </section>
      )}
      <ActionBar><Go onClick={go}>Next: The draft</Go></ActionBar>
      {page != null && <PlayerPage F={F} id={page} owner={owner} onClose={() => setPage(null)} />}
    </>
  )
}
