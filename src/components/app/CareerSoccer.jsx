// CAREER, SOCCER's own screens: the season recap (the World Cup, his country), the transfer window, the
// season-by-season table, the Ballon d'Or banners and the big nights. Loaded only for a soccer career
// (AppCareer.jsx lazy-loads them), so football and basketball never download them.
import { useEffect, useMemo, useRef, useState } from 'react'
import { sportOf, openTalks, acceptTalks, closeTalks, roundOdds, playoffRound, combinePos, gameCast, gamesMode, POS_ATTR, breakDrill, breakTrain, breakRest, januaryOffers, januaryStay, januaryMove, byeTraits, byeTarget, byeHurt, stepCost, bodyMaxed, BYE_REST } from '../../lib/career'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { wageText, feeText, nationName, theNation, nationFlag, nationColors, stayPut } from '../../lib/careerSoccer'
import { sfx, haptic } from '../../lib/juice'
import { IconArrow, IconTrophy, IconStar, IconCrown, IconMedal, IconFlame, IconCheck, IconCaret } from './icons'
import { Analytics, CareerGame, Talks, gameTitle, honorsOf, fmt, ClubLogo, tieText, seasonOf, ordinalOf, inLeague } from './AppCareer'
import './squad-soccer.css'   // (the league table's rows: Squad Builder's soccer season, .sq-table)

// ── The league table ─────────────────────────────────────────────────────────
// Rows are the season engine's standings: { short, name, played, wins, draws, losses, gf, ga, gd, points, pos, isUs }.
// The table as it stands after his club's matches so far: the engine's (lib/careerSoccer.js soccerTable: every club's
// results matchweek by matchweek, his club's as they were really played; each row carries its zone). null before a
// ball is kicked, and for a season begun before the engine kept the table (until that season is over)
export function tableNow(c) {
  try { const rows = sportOf(c).x?.table?.(c); return Array.isArray(rows) && rows.length ? rows : null } catch { return null }
}
// a booked season's final table (lib/careerSoccer.js tableOf: the short form on the season, read back with its zones)
const seasonTable = (S, s) => { try { return S.x?.tableOf?.(s) ?? null } catch { return null } }
// where a place in the table leads (each row's zone is the engine's): the Champions League, the Europa League, the
// Conference League, the drop; a relegation play-off (Germany, France); in a second tier, promotion and its play-offs
// a simulated tie in words, by how it finished (a 2–2, 2–0 was 'never in doubt' before 2026-11-25)
const autoLine = x => { const m = Math.abs(x.mySc - x.oppSc); return x.pens ? 'decided from the spot' : x.won ? (m >= 3 ? 'never in doubt' : m === 2 ? 'a comfortable passage' : 'a tight one') : (m >= 3 ? 'never close' : m === 2 ? 'second best' : 'so close') }
const ZONE_WORD = { ucl: 'Champions League', uel: 'Europa League', uecl: 'Conference League', up: 'Promotion', playoff: 'Play-off', down: 'Relegation' }
const ZONES = Object.keys(ZONE_WORD)
const zoneOf = r => (ZONES.includes(r?.zone) ? r.zone : null)
// The table: the top four, his club's place and the bottom three, FULL TABLE a tap away (the whole of it when `all`)
export function LeagueTable({ c, rows, mine = c.team, all: all0 = false }) {
  const S = sportOf(c)
  const [all, setAll] = useState(all0)
  if (!rows?.length) return null
  const size = rows.length
  const me = rows.findIndex(r => r.isUs || r.short === mine)
  const shown = all ? rows : rows.filter((r, i) => i < 4 || Math.abs(i - me) <= 1 || i >= size - 3)
  const zones = ZONES.filter(z => rows.some(r => zoneOf(r) === z))
  return (
    <div className="cr-lt">
      <div className="sq-table" role="table" aria-label="League table">
        <div className="sq-table-row sq-table-head" role="row"><span>#</span><span>CLUB</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>PTS</span></div>
        {shown.map((r, j) => {
          const i = rows.indexOf(r), z = zoneOf(r)
          const gap = j > 0 && i - rows.indexOf(shown[j - 1]) > 1
          return (
            <div key={r.short} className={`sq-table-row${i === me ? ' is-mine' : ''}${z ? ` is-${z}` : ''}${gap ? ' is-gap' : ''}`} role="row">
              <span>{r.pos ?? i + 1}</span>
              <span className="sq-table-team"><ClubLogo S={S} short={r.short} extra={!!r.extra} className="cr-lt-crest" /><b>{r.name ?? S.teamOf(r.short)?.name ?? r.short}</b></span>
              <span>{r.played}</span><span>{r.wins}</span><span>{r.draws}</span><span>{r.losses}</span><span>{r.gd > 0 ? `+${r.gd}` : r.gd}</span><b>{r.points}</b>
            </div>
          )
        })}
      </div>
      <div className="cr-lt-key">{zones.map(z => <span key={z} className={`is-${z}`}><i />{ZONE_WORD[z]}</span>)}</div>
      {size > shown.length && <button type="button" className="ag-btn ag-btn--ghost cr-lt-more" onClick={() => { setAll(true); sfx('tap') }}>FULL TABLE</button>}
      {all && !all0 && <button type="button" className="ag-btn ag-btn--ghost cr-lt-more" onClick={() => { setAll(false); sfx('tap') }}>SHORT TABLE</button>}
    </div>
  )
}
// The hub's table: one thin bar through the season (his club's place and points), opened for the table itself
// (the award race's bar in football and basketball Career: the same piece)
export function SoccerTable({ c, games }) {
  const a = c.active
  const done = !!a?.final || (a?.k ?? 0) >= (a?.base?.games?.length ?? 99)
  const [open, setOpen] = useState(false)
  // (nothing to show before a ball is kicked)
  const rows = games.length || done ? tableNow(c) : null
  if (!rows?.length) return null
  const me = rows.find(r => r.isUs || r.short === c.team)
  const z = zoneOf(me)
  const bar = (
    <button type="button" className={`cr-race-bar cr-lt-bar${open ? ' is-open' : ''}`} onClick={() => { setOpen(o => !o); sfx('tap') }} aria-expanded={open}>
      <span><small>{done ? 'FINAL TABLE' : 'THE TABLE'}</small><b>{me ? ordinalOf(me.pos).toUpperCase() : '—'}</b></span>
      {me && <span><small>PTS</small><b>{me.points}</b></span>}
      {z && <span className={`cr-lt-zone is-${z}`}><i />{z === 'down' ? 'RELEGATION ZONE' : `${ZONE_WORD[z].toUpperCase()} PLACE`}</span>}
      <IconCaret dir={open ? 'up' : 'down'} size={14} />
    </button>
  )
  if (!open) return bar
  return <div className="cr-race cr-lt-wrap ag-pop">{bar}<LeagueTable c={c} rows={rows} /></div>
}


export function SoccerRecap({ c, last, card, shareSeason }) {
  const S = sportOf(c)
  const met = (last.goals ?? []).filter(g => g.met).length
  const st = last.stats
  const wc = last.wc
  const bdo = last.bdo
  // (his club's trophies, and his country's: the World Cup, the continental championship)
  const won = (last.trophies?.length ?? 0) + (wc?.champion ? 1 : 0) + (last.cont?.champion ? 1 : 0)
  return (
    <div className={`ag-card cr-wrap ag-pop${won ? ' is-ring' : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow"><span className="cr-nb">{seasonOf(last.season)}</span> · {ordinalOf(last.pos).toUpperCase()} IN {inLeague(last.league).toUpperCase()} · <span className="cr-nb">{last.wins}–{last.draws}–{last.losses}</span></span>{won > 0 && <span className="cr-ring"><IconTrophy size={13} /> {won === 1 ? 'TROPHY' : `${won} TROPHIES`}</span>}</div>
      <div className="cr-wrap-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[[st.goals, 'GOALS'], [st.assists, 'ASSISTS'], [st.apps, 'APPS'], [st.lgGoals, 'LEAGUE G'], [st.xg, 'LEAGUE xG'], [st.avgRating ? st.avgRating.toFixed(2) : '—', 'RATING']].map(([v, k]) => <span key={k}><b>{typeof v === 'number' ? fmt(v) : v}</b><small>{k}</small></span>)}
      </div>
      <div className="cr-badges">
        {(last.trophies ?? []).map(t => <span key={t} className="cr-badge is-gold"><IconTrophy size={12} /> {t.toUpperCase()}</span>)}
        {wc?.champion && <span className="cr-badge is-gold"><IconTrophy size={12} /> WORLD CUP</span>}
        {last.cont?.champion && <span className="cr-badge is-gold"><IconTrophy size={12} /> {String(last.cont.name ?? 'CONTINENTAL TITLE').toUpperCase()}</span>}
        {last.award ? <span className="cr-badge is-gold"><IconCrown size={12} /> BALLON D'OR</span> : bdo?.rank <= 30 && <span className="cr-badge"><IconStar size={12} /> BALLON D'OR · {ordinalOf(bdo.rank).toUpperCase()}</span>}
        {last.allPro && <span className="cr-badge is-gold"><IconMedal size={12} /> {(last.bootName ?? 'GOLDEN BOOT').toUpperCase()}</span>}
        {last.poty && <span className="cr-badge is-gold"><IconStar size={12} /> {(last.potyName ?? 'PLAYER OF THE SEASON').toUpperCase()}</span>}
        {last.proBowl && !last.poty && <span className="cr-badge"><IconStar size={12} /> TEAM OF THE SEASON</span>}
        {last.shoe && <span className="cr-badge is-gold"><IconMedal size={12} /> GOLDEN SHOE</span>}
        {last.roy && <span className="cr-badge is-gold"><IconStar size={12} /> KOPA TROPHY</span>}
        {last.fmvp && <span className="cr-badge is-gold"><IconTrophy size={12} /> MAN OF THE MATCH IN THE FINAL</span>}
        {last.promoted && <span className="cr-badge is-gold"><IconTrophy size={12} /> PROMOTED{last.promotedHow === 'playoff' ? ' · THE PLAY-OFFS' : last.pos === 1 ? ' AS CHAMPIONS' : ''}</span>}
        {last.role !== 'Starter' && <span className="cr-badge">{String(last.role ?? '').toUpperCase()}</span>}
        {last.records.map((r, i) => <span key={i} className="cr-badge is-rec"><IconFlame size={12} /> {r}</span>)}
      </div>
      <div className="cl-season-notes">
        {last.moved && <p><b>January</b> {last.moved.loan ? `Joined ${last.moved.toName} on loan from ${last.moved.fromName} until the end of the season` : `Signed for ${last.moved.toName} from ${last.moved.fromName}${last.moved.fee ? ` for ${feeText(last.moved.fee, last.moved.from)}` : ''}`}</p>}
        {last.cupName && <p><b>{last.cupName}</b> {last.cupResult === 'Winners' ? 'Winners' : last.cupResult === 'Runners-up' ? 'Beaten in the final' : last.cupResult ? `Out in the ${String(last.cupResult).toLowerCase()}` : '—'}</p>}
        {last.europe && <p><b>{last.europe.name}</b> {last.europe.result === 'Winners' ? 'Winners' : last.europe.result === 'Runners-up' ? 'Beaten in the final' : `Out in the ${String(last.europe.result ?? 'league phase').toLowerCase()}`}</p>}
        {last.rounds?.length > 0 && <p><b>The big nights</b> {last.rounds.map(r => `${r.won ? 'W' : 'L'} ${tieText(r)} ${r.opponent}`).join(' · ')}</p>}
        {bdo && !last.award && bdo.winner && bdo.rank <= 10 && <p><b>Ballon d'Or</b> {ordinalOf(bdo.rank)}. Won by {bdo.winner.name}.</p>}
        {last.playoff?.stay && last.playoff.won && <p><b>{last.playoff.name}</b> Won: {last.teamName} stay up.</p>}
        {last.relegated && <p><b>Relegated</b> {last.teamName} go down to {S.x?.tier2Name?.(last.team) ?? 'the second tier'}.</p>}
        {last.tier === 2 && <p><b>{last.promoted ? 'Promoted' : 'Not promoted'}</b> {last.promoted ? `${last.teamName} go up${last.promotedHow === 'playoff' ? ' through the play-offs' : last.pos === 1 ? ' as champions' : ` in ${ordinalOf(last.pos)} place`}.` : `${last.teamName} stay in ${inLeague(last.league)} for another season.`}</p>}
        {last.qualified && <p><b>Next season</b> {last.qualified === 'ucl' ? (last.uclq ? 'The Champions League, through the qualifiers' : 'The Champions League') : last.uclq === false ? 'The Europa League, after going out in the Champions League qualifiers' : last.qualified === 'uel' ? 'The Europa League' : 'The Conference League'}</p>}
        <p><b>{nationName(c.nation)}</b> {last.caps ? `${last.caps} ${last.caps === 1 ? 'cap' : 'caps'}, ${last.intlGoals} ${last.intlGoals === 1 ? 'goal' : 'goals'}${last.intlRole && last.intlRole !== 'Starter' ? ` (${last.intlRole.toLowerCase()})` : ''}` : `Not called up${last.intlRank ? `: ${ordinalOf(last.intlRank)} in the manager's order of strikers` : ''}`}</p>
        {last.missed > 0 && <p><b>Missed</b> {last.missed} {last.missed === 1 ? 'match' : 'matches'}</p>}
      </div>
      {[wc, last.cont].filter(Boolean).map(t => <Tournament key={t.name ?? 'wc'} t={t} />)}
      {seasonTable(S, last)?.length > 0 && (
        <div className="cr-lt-card">
          <span className="ag-eyebrow">{String(last.league ?? 'THE LEAGUE').toUpperCase()} · THE FINAL TABLE</span>
          <LeagueTable c={c} rows={seasonTable(S, last)} mine={last.team} />
        </div>
      )}
      <Analytics c={c} s={last} />
      {last.goals.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">GOALS · {met}/{last.goals.length}</span>{last.goals.map(g => <span key={g.k} className={`cr-goal${g.met ? ' is-met' : ' is-miss'}`}>{g.met ? <IconCheck size={11} /> : null} {g.label}</span>)}</div>}
      <button className="ag-btn ag-btn--ghost cl-season-share" onClick={shareSeason} disabled={card.busy}>{card.busy ? 'MAKING THE CARD…' : `SHARE THE ${seasonOf(last.season)} SEASON`}</button>
      {card.img && <img src={card.img} alt={`${c.name}'s ${seasonOf(last.season)} season card`} className="cl-preview" />}
      {card.img && <a className="ag-btn ag-btn--ghost cl-season-share" href={card.img} download={`season-${seasonOf(last.season)}.png`}>SAVE THE IMAGE</a>}
      {card.failed && <p className="cr-note">{card.img ? "Couldn't open sharing here. Save the image instead." : "Couldn't make the card. Try again."}</p>}
    </div>
  )
}
// His country's summer: the World Cup, or the continental championship (the Euros, the Copa América, AFCON: s.cont, the
// World Cup's shape with its name). Not qualified, left out, or how far they went and what he did
function Tournament({ t }) {
  const name = t.name ?? 'World Cup'
  return (
    <div className={`ag-card cr-wc${t.champion ? ' is-ring' : ''}`}>
      <span className="ag-eyebrow">{/^the /i.test(name) ? '' : 'THE '}{t.year} {name.toUpperCase()} · {nationName(t.nation).toUpperCase()}</span>
      {t.qualified === false ? <p className="cr-note">{theNation(t.nation).replace(/^t/, 'T')} didn't qualify.</p>
        : !t.called ? <p className="cr-note">Left out of the squad. He watches it at home.</p> : <>
          <b className="cr-wc-finish">{t.champion ? (t.name ? 'WINNERS' : 'WORLD CHAMPIONS') : String(t.finish ?? '').toUpperCase()}</b>
          <p className="cr-note">{t.goals} {t.goals === 1 ? 'goal' : 'goals'}, {t.assists} {t.assists === 1 ? 'assist' : 'assists'} in {t.apps} {t.apps === 1 ? 'match' : 'matches'}{t.boot?.won ? '. The Golden Boot.' : t.boot?.winner ? `. The Golden Boot went to ${t.boot.winner}.` : '.'}{t.ball ? ` The ${t.ball}.` : ''}{t.young ? ' Best Young Player.' : ''}</p>
          <div className="cr-goals">{(t.games ?? []).map((g, i) => <span key={i} className={`cr-goal${g.won ? ' is-met' : g.drawn && !g.pens ? '' : ' is-miss'}`}>{g.stage === 'group' ? 'Group' : g.round ?? g.stage}: {g.mySc}–{g.oppSc}{g.pens ? ` (${g.pens[0]}–${g.pens[1]} pens)` : ''} {g.oppName ?? g.opp}{g.goals ? ` · ${g.goals}G` : ''}</span>)}</div>
        </>}
    </div>
  )
}
// The summer window: bids from other clubs, a new deal, a loan; out of contract, the clubs that want him on a free
const OFFER_TAG = { bid: 'BID', loan: 'LOAN', renew: 'NEW DEAL', stay: 'STAY', contender: 'CONTENDER', payer: 'TOP WAGES', late: 'LATE OFFER', drop: 'A DIVISION DOWN' }
// One offer: the club, its pitch, then the facts in a line: what it is and the fee (a bid at his release clause, or
// his relegation clause, says so: his club can't refuse it), his place there, the club's league and, in January, where
// it stands in it (offer.place)
function OfferRow({ c, o, onPick }) {
  const S = sportOf(c)
  const what = o.clause === 'release' ? `RELEASE CLAUSE MET · ${feeText(o.fee, c.team)}` : o.clause === 'relegation' ? `RELEGATION CLAUSE · ${feeText(o.fee, c.team)}` : o.kind === 'loan' && o.half ? 'LOAN TO THE END OF THE SEASON' : `${OFFER_TAG[o.kind] ?? 'OFFER'}${o.fee ? ` · ${feeText(o.fee, c.team)} fee` : ''}`
  const stand = o.stand ? (o.stand.starter ? 'First choice' : `${o.stand.role ? `${o.stand.role}, b` : 'B'}ehind ${o.stand.behind}`) : o.fit.status
  return (
    <button className={`cr-offer${o.kind === 'contender' ? ' is-contender' : ''}`} onClick={onPick}>
      <ClubLogo S={S} short={o.team} />
      <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{what} · {stand} · {o.place?.league ?? (o.tier2 ? o.tier2.replace(/^the /, '').replace(/^./, x => x.toUpperCase()) : o.fit.conf)}{o.place ? ` · ${ordinalOf(o.place.pos)}` : ''}</i></span>
      <span className="cr-offer-money"><b>{wageText(o.perYear, o.team).replace(' a week', '')}</b><small>A WEEK · {o.kind === 'loan' && o.half ? 'LOAN' : `${o.years} ${o.years === 1 ? 'YR' : 'YRS'}`}</small></span>
    </button>
  )
}
// the bids his own club turned down this summer (c.off.rejected): said plainly, under the offers
function Rejected({ c }) {
  const list = c.off?.rejected ?? []
  if (!list.length || !(c.contract?.left > 0)) return null
  const S = sportOf(c)
  return (
    <div className="ag-card cr-rejected">
      <span className="ag-eyebrow">{list.length === 1 ? 'A BID TURNED DOWN' : 'BIDS TURNED DOWN'}</span>
      {list.map(x => <p key={x.team} className="cr-rejected-row"><ClubLogo S={S} short={x.team} className="cr-lt-crest" /><span>{c.fit?.name} turned down a <b>{feeText(x.fee, c.team)}</b> bid from <b>{x.name}</b>. {c.name} was not for sale at that price.</span></p>)}
    </div>
  )
}
export function SoccerWindow({ c, setCareer, noCalls }) {
  const S = sportOf(c)
  const down = !!S.x?.isDown?.(c), tier2 = S.x?.tier2Name?.(c.team) ?? 'the second tier'
  // (just relegated: the club went down this summer; a season or more down there, or a move a division down, isn't news)
  const wentDown = down && !c.down?.signed && c.down?.year === c.seasons?.[c.seasons.length - 1]?.year
  if (noCalls) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">OUT OF CONTRACT</span><p className="cr-note">Out of contract at {c.age}, and no club calls. That's a career.</p></div>
  if (!c.offers?.length) {
    // (what he did this summer; a summer with nothing to answer, only a bid his club turned down, says that)
    const mine = [...c.decisions].reverse().find(d => d.year === c.year + 1)?.text
    return <><div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">THE WINDOW SHUTS</span><p className="cr-note">{mine ?? (c.off?.rejected?.length ? `No bid was accepted this summer. ${c.name} stays at ${c.fit?.name}${down ? ` in ${tier2}` : ''}.` : `Staying at ${c.fit?.name}.`)}</p></div><Rejected c={c} /></>
  }
  const free = c.contract.left <= 0
  return (
    <div className="cr-offers ag-pop">
      <span className="ag-eyebrow">{free ? 'OUT OF CONTRACT' : wentDown ? 'RELEGATED · THE TRANSFER WINDOW' : 'THE TRANSFER WINDOW'} · {c.offers.length} {c.offers.length === 1 ? 'OFFER' : 'OFFERS'} · TAP ONE TO TALK</span>
      {wentDown && !free && <p className="cr-note">{c.down?.clause ? `${c.fit?.name} are down, and the relegation clause in his contract is live: a top-flight club can sign him for ${feeText(c.down.fee, c.team)}.` : `${c.fit?.name} are down. With no relegation clause in his contract, the club decides who it sells to.`}</p>}
      {c.offers.map(o => <OfferRow key={`${o.kind}-${o.team}`} c={c} o={o} onPick={() => { setCareer(o.kind === 'loan' ? signOfferNow(c, o) : openTalks(c, o)); sfx('tap') }} />)}
      {!free && <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(stayPut(c)); sfx('tap') }}>STAY PUT · {c.contract.left} {c.contract.left === 1 ? 'YEAR' : 'YEARS'} LEFT AT {String(c.fit?.name ?? '').toUpperCase()}{down ? ` IN ${tier2.toUpperCase()}` : ''}</button>}
      <Rejected c={c} />
    </div>
  )
}
// ── The January window (lib/career.js januaryNow): the bids and the loan on the table half-way through the season,
// the summer window's look. A bid opens talks (the summer's table); signed, he finishes the season at the new club
// (januaryMove: the season goes on from a new director). A loan runs to the end of the season. STAY PUT closes it.
export function SoccerJanuary({ c, setCareer, getD, setD }) {
  const a = c.active, offers = januaryOffers(c)
  const move = o => {
    const [n, d] = januaryMove(c, getD(), o)
    if (n === c || n.team === c.team) { setCareer(closeTalks(c)); sfx('deny'); return }
    setD(d); setCareer({ ...n, talks: null }); sfx('purchase'); haptic('success')
    requestAnimationFrame(() => document.querySelector('.cr-hub')?.scrollTo({ top: 0, behavior: 'smooth' }))
  }
  // (talks that broke down: that club is gone from the window)
  const closed = () => { const t = c.talks; setCareer({ ...closeTalks(c), offers: null, ...(t?.walked ? { active: { ...a, jan: { ...a.jan, offers: (a.jan.offers ?? []).filter(o => o.team !== t.team) } } } : {}) }) }
  if (c.talks) return <Talks c={c} setCareer={setCareer} onSign={() => move(c.talks)} onClose={closed} />
  if (!offers.length) return null
  return (
    <div className="cr-offers cr-jan ag-pop">
      <span className="ag-eyebrow">THE JANUARY WINDOW · {offers.length} {offers.length === 1 ? 'OFFER' : 'OFFERS'} · TAP ONE TO TALK</span>
      <p className="cr-note">Half-way through the season. A move now, and {c.name} finishes it at the new club.</p>
      {offers.map(o => <OfferRow key={`${o.kind}-${o.team}`} c={c} o={o} onPick={() => { if (o.kind === 'loan') move(o); else { setCareer(openTalks(c, o)); sfx('tap') } }} />)}
      <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(januaryStay(c, getD())); sfx('tap') }}>STAY PUT · {c.contract.left} {c.contract.left === 1 ? 'YEAR' : 'YEARS'} LEFT AT {String(c.fit?.name ?? '').toUpperCase()}</button>
    </div>
  )
}
// ── The international break (lib/career.js breakNow): November, two weeks without a league match. Called up, he's
// away with his country (his place in the manager's order of strikers: S.x.callUp); left out, the bye week's choice:
// extra work on the training ground (one drill, a shot at a grade) or rest.
const orderWord = ['', 'first choice', 'second in line', 'third in line', 'fourth in line', 'fifth in line', 'sixth in line']
function StrikerOrder({ c, call }) {
  if (!call?.order?.length) return null
  return (
    <div className="crl-bench cr-brk-order">
      <span className="ag-eyebrow">{nationName(c.nation).toUpperCase()} · THE STRIKERS</span>
      {call.order.map((p, i) => <span key={p.name + i} className={`crl-depth${p.me ? ' is-you' : ''}`}><i>{i + 1}</i><b>{p.name}</b><small>{p.ovr} OVR · age {p.age}</small></span>)}
    </div>
  )
}
export function SoccerBreak({ c, setCareer, getD }) {
  const S = sportOf(c), a = c.active, brk = a.brk, mode = gamesMode(c)
  const call = useMemo(() => { try { return S.x.callUp(c) } catch { return null } }, [c.seed, c.year, c.ovr, c.nation]) // eslint-disable-line react-hooks/exhaustive-deps
  const game = useMemo(() => breakDrill(c, mode === 'simple' ? g => !!SIMPLE_GAMES[g] : null), [c.seed, c.year, c.pos, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const nation = nationName(c.nation), the = theNation(c.nation)
  const Head = <span className="cr-brk-head"><img src={nationFlag(c.nation)} alt="" className="cr-brk-flag" onError={e => { e.currentTarget.style.display = 'none' }} /><span className="ag-eyebrow">NOVEMBER · THE INTERNATIONAL BREAK</span></span>
  if (brk.called) return (
    <div className="ag-card cr-brk ag-pop">
      {Head}
      <h3 className="sm-moment-title">Called up by {the}</h3>
      <p className="sm-moment-body">{call?.role === 'Starter' ? `${c.name} leads the line for ${the} in this month's internationals.` : call?.role === 'Rotation' ? `${c.name} is in the ${nation} squad, second choice up front: minutes off the bench, and a start if the manager rotates.` : `${c.name} is in the ${nation} squad as the third striker. He travels, and waits for his chance.`} The league is back in a fortnight.</p>
      <StrikerOrder c={c} call={call} />
    </div>
  )
  const D = getD(), hurt = byeHurt(c, D)
  const playing = brk.training && !hurt ? brk.training : null
  const label = t => POS_ATTR[c.pos]?.[t]?.label ?? t
  const listOf = l => (l.length > 1 ? `${l.slice(0, -1).join(', ')} or ${l[l.length - 1]}` : l[0] ?? '')
  const done = (g, res) => { const n = breakTrain(c, getD(), g, res.score, res.hit, mode === 'off'); setCareer(n); if (n.active.brk?.done?.gain) { sfx('claim'); haptic('success') } else sfx('tap') }
  if (playing) return (
    <div className="ag-card cr-camp cr-bye ag-pop">
      <span className="ag-eyebrow">THE INTERNATIONAL BREAK · {gameTitle(c, playing)}</span>
      <p className="cr-note">Extra work with the coaches while the internationals are away. A good session can raise {listOf(byeTraits(c, playing).map(label))} a grade.</p>
      <CareerGame c={c} setCareer={setCareer} empty team={c.fit} opp={c.fit} pos={combinePos(c)} cast={gameCast(c)} key={playing} game={playing} build={c.build} seed={`${c.seed}-brk-${c.year}`} lock={`${c.seed}-brk-${c.year}`} onDone={res => done(playing, res)} />
    </div>
  )
  const tgt = game ? byeTarget(c, game) : null, top = !!tgt && !(c.build[tgt].faded > 0) && stepCost(c.build[tgt].val, c) > 1
  const why = !call ? '' : c.age < 19 && call.rank <= 3 ? ` The manager has him down as ${orderWord[call.rank] ?? 'one for later'}, and wants another year in him first.` : call.rank > 3 ? ` He is ${orderWord[call.rank] ?? 'well down the order'} among ${nation}'s strikers, and the manager takes three.` : ' The manager wants more from his season first.'
  return (
    <div className="sm-moment cr-bye cr-brk ag-pop">
      {Head}
      <h3 className="sm-moment-title">No call from {the}</h3>
      <p className="sm-moment-body">{c.name} isn't in the {nation} squad this month.{why}</p>
      <div className="sm-options">
        <button className="sm-option" disabled={hurt || !game} onClick={() => { setCareer({ ...c, active: { ...a, brk: { ...brk, training: game } } }); sfx('tap') }}>
          <b>Extra work{game ? `: ${String(gameTitle(c, game) ?? '').toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase())}` : ''}</b>
          <small>{hurt ? 'Not this fortnight: he is in the treatment room.' : !game ? `Nothing left to train at ${c.age}.` : `One drill with the coaches. A good session can raise ${listOf(byeTraits(c, game).map(label))} a grade: the cleaner it is, the better the chance.${top ? ' This close to the top, a fortnight rarely moves a grade.' : ''}${mode === 'off' ? ' Simulated from his ratings.' : ''}`}</small>
        </button>
        <button className="sm-option" onClick={() => { setCareer(breakRest(c, getD())); sfx('claim'); haptic('success') }}>
          <b>Rest and recover</b>
          <small>{bodyMaxed(c) ? 'Durability is already as high as it goes.' : `Durability +${BYE_REST}, guaranteed.`}{hurt && !a.out ? ' He is back from the injury a match sooner.' : ''}</small>
        </button>
      </div>
      <StrikerOrder c={c} call={call} />
    </div>
  )
}
// how the fortnight went, until the next match
export function SoccerBreakDone({ c }) {
  const d = c.active?.brk?.done
  // (it comes into view: after the drill the page is left wherever the game's READY button was)
  const box = useRef(null)
  useEffect(() => { const r = box.current?.getBoundingClientRect(); if (r && (r.top < 64 || r.bottom > window.innerHeight - 140)) box.current.scrollIntoView({ block: 'center' }) }, [])
  if (!d) return null
  const gain = d.gain
  const head = d.pick === 'rest' ? (d.to > d.from ? `Durability +${Math.round((d.to - d.from) * 10) / 10}` : 'Rested') : gain ? `${gain.label} ${gain.from} → ${gain.to}` : 'No new grade'
  const sub = d.pick === 'rest' ? (d.healed ? `Back from the ${d.healed.kind} a match sooner.` : 'Two weeks off his feet while the internationals were away.') : gain ? 'The extra work paid off: he plays the rest of the season at the new grade.' : d.hit ? 'A good session, no new grade this time.' : 'Not his best session. Back to it after the weekend.'
  return (
    <div className="ag-card cr-bye-done ag-pop" ref={box}>
      <span className="ag-eyebrow">THE INTERNATIONAL BREAK · {d.pick === 'rest' ? 'REST' : 'EXTRA WORK'}{d.sim ? ' · SIMULATED' : ''}</span>
      <b className={`cr-bye-head${gain || (d.pick === 'rest' && d.to > d.from) ? ' is-up' : ''}`}>{head}</b>
      <p className="cr-note">{sub}</p>
    </div>
  )
}
// (a loan is a loan: no talks, he goes)
const signOfferNow = (c, o) => acceptTalks(openTalks(c, o))
export function SoccerSeasonTable({ c, t }) {
  const S = sportOf(c)
  const [open, setOpen] = useState(null)
  const flip = y => { setOpen(o => (o === y ? null : y)); sfx('tap') }
  const rated = c.seasons.filter(s => s.stats.apps)
  const avgRating = rated.length ? rated.reduce((a, s) => a + (s.stats.avgRating ?? 0) * s.stats.apps, 0) / Math.max(1, rated.reduce((a, s) => a + s.stats.apps, 0)) : 0
  return (
    <div className="ag-card cr-seasons ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">SEASON BY SEASON · ALL COMPETITIONS</span></div>
      <div className="cr-seasons-scroll" tabIndex={0} role="region" aria-label="Season by season stats">
        <table>
          <thead><tr><th scope="col">SEASON</th><th scope="col">CLUB</th><th scope="col">APPS</th><th scope="col">G</th><th scope="col">A</th><th scope="col">LEAGUE xG</th><th scope="col">RATING</th><th scope="col">LEAGUE</th><th scope="col" aria-label="Honors" /></tr></thead>
          <tbody>
            {c.seasons.map(s => [
              <tr key={s.year} className={`cr-seasons-row${s.trophies?.length ? ' is-ring' : ''}${open === s.year ? ' is-open' : ''}`} tabIndex={0} aria-expanded={open === s.year} onClick={() => flip(s.year)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(s.year) } }}>
                <th scope="row"><IconArrow size={10} className="cr-seasons-chev" />{seasonOf(s.season)}</th>
                <td className="cr-seasons-team"><img src={S.logo(s.team)} alt="" loading="lazy" />{s.team}</td>
                <td>{s.stats.apps}</td><td>{s.stats.goals}</td><td>{s.stats.assists}</td><td>{fmt(s.stats.xg)}</td><td>{s.stats.avgRating ? s.stats.avgRating.toFixed(2) : '—'}</td><td>{ordinalOf(s.pos)}</td>
                <td className="cr-seasons-ico">{s.trophies?.length > 0 && <IconTrophy size={13} />}{s.award && <IconCrown size={13} />}{s.allPro ? <IconMedal size={13} /> : s.proBowl ? <IconStar size={13} /> : null}</td>
              </tr>,
              open === s.year && (
                <tr key={`${s.year}-more`} className="cr-seasons-more"><td colSpan={9}><div className="cr-seasons-detail">
                  {honorsOf(s, S, c.pos).length > 0 && <p className="cr-seasons-honors">{honorsOf(s, S, c.pos).join(' · ')}</p>}
                  <p className="cr-seasons-honors">{s.stats.lgGoals} in {inLeague(s.league)}{s.stats.cupGoals ? ` · ${s.stats.cupGoals} in the cup` : ''}{s.stats.euroGoals ? ` · ${s.stats.euroGoals} in Europe` : ''}{s.caps ? ` · ${s.caps} caps, ${s.intlGoals} for ${nationName(c.nation)}` : ''}</p>
                  <Analytics c={c} s={s} />
                </div></td></tr>
              ),
            ])}
          </tbody>
          <tfoot><tr><th scope="row">CAREER</th><td /><td>{t.stats.apps ?? 0}</td><td>{t.stats.goals ?? 0}</td><td>{t.stats.assists ?? 0}</td><td>{fmt(t.stats.xg ?? 0)}</td><td>{avgRating ? avgRating.toFixed(2) : '—'}</td><td /><td /></tr></tfoot>
        </table>
      </div>
    </div>
  )
}
// The Ballon d'Or banners: every year he finished in the top three, the wins in gold (soccer's rafters)
export function AwardBanners({ c }) {
  const years = c.seasons.filter(s => (s.bdo?.rank ?? 99) <= 3)
  if (!years.length) return null
  return (
    <div className="cl-case cl-bdo">
      {years.map(s => <span key={s.year} className={`cl-trophy${s.award ? ' is-gold' : ''}`}><IconCrown size={18} /><b>{s.season + 1}</b><small>{s.award ? "BALLON D'OR" : `${ordinalOf(s.bdo.rank).toUpperCase()} PLACE`}</small></span>)}
    </div>
  )
}
// a play-off's last tie, told: up or down
const promoLine = (x, club) => (x.up ? (x.won ? `${club} are promoted.` : `Beaten in the ${x.stage === 'Relegation play-off' ? x.name : `${x.compName} ${x.stage.toLowerCase()}`}. ${club} stay down.`) : x.won ? `${club} stay up.` : `${club} are relegated.`)
// The big nights: the European knockouts and the cup final, one tie at a time (a close one turns on a key moment)
export function SoccerNights({ c, setCareer, onBook, step, setStep, game, sit }) {
  const S = sportOf(c)
  const po = c.active.po
  const rd = po.rounds[po.idx]
  const last = po.line[po.line.length - 1]
  // (his country's knockouts, r.intl: the nations, their flags and their shirts)
  const natTeam = short => { const k = nationColors(short); return { short, name: nationName(short), color: k?.[0] ?? '#26302c', color2: k?.[1] ?? '#e4e4e7' } }
  const oppOf = r => (r.intl ? natTeam(r.opp) : r.extra ? { short: r.opp, name: r.oppName, color: '#3f3f46', color2: '#e4e4e7' } : S.teamOf(r.opp))
  const usOf = r => (r?.intl ? c.nation : c.team)
  const Crest = ({ r, short, ex }) => (r?.intl ? <img src={nationFlag(short)} alt="" className="cr-po-flag" /> : <ClubLogo S={S} short={short} extra={ex} />)
  // (from the state his chance comes up in: lib/inGame.js)
  const odds = rd && game && rd.close !== false ? roundOdds(c, rd, game) : null
  const pct = x => Math.min(99, Math.max(1, Math.round(x * 100)))
  // nothing for him to play: a tie that never came down to a moment, or the key moments turned off
  const simmed = !!rd && (rd.close === false || gamesMode(c) === 'off')
  // a tie played: its result comes into view (the page is left wherever the game's READY button was, the result card
  // off the top of the screen)
  const box = useRef(null)
  useEffect(() => {
    if (step !== 'result' && po.stage !== 'done') return
    const r = box.current?.getBoundingClientRect()
    if (r && (r.top < 64 || r.top > window.innerHeight - 280)) box.current.scrollIntoView({ block: 'center' })
  }, [step, po.line.length, po.stage])
  if (po.stage === 'done' || step === 'result') {
    const x = last
    const nextOf = x => { const i = po.rounds.findIndex(r => r.name === x.name); return po.rounds.slice(i + 1).find(r => r.track === x.track && !r.skip) }
    return (
      <div className="cr-po" ref={box}>
        {x && (
          <div className={`ag-card cr-po-result ag-pop${x.won ? ' is-w' : ' is-l'}`}>
            <span className="ag-eyebrow">{x.legs?.length > 1 ? 'AGGREGATE' : 'FULL TIME'} · {x.name.toUpperCase()}</span>
            <div className="cr-po-board">
              {[[usOf(x), x.mySc, x.won, false], [x.opp, x.oppSc, !x.won, x.extra]].map(([t, sc, up, ex]) => (
                <div key={t} className={`cr-po-side${up ? ' is-up' : ''}`} style={{ '--tc': ex ? '#3f3f46' : x.intl ? natTeam(t).color : S.teamOf(t)?.color ?? '#26302c' }}>
                  <Crest r={x} short={t} ex={ex} />
                  <small>{t}</small>
                  <b>{sc}</b>
                </div>
              ))}
            </div>
            <b>{x.track === 'promo' && (x.up || x.stay) ? promoLine(x, c.fit.name) : x.won ? (x.final ? (x.intl ? `${nationName(c.nation)} win the ${x.compName}.` : `${x.compName} winners.`) : `Through to the ${nextOf(x)?.stage?.toLowerCase() ?? 'next round'}.`) : x.final ? `Beaten in the ${x.compName} final.` : x.intl && x.key === 'sf' && x.track === 'wc' ? `Beaten in the semi-final. ${nationName(c.nation)} play for third place.` : `Out of the ${x.compName} in the ${String(x.stage).toLowerCase()}.`}</b>
            <small>{tieText(x)}{x.sat ? ' · watched from the stand' : ` · ${x.goals ? `${x.goals} ${x.goals === 1 ? 'goal' : 'goals'}` : 'no goal'}${x.assists ? `, ${x.assists} ${x.assists === 1 ? 'assist' : 'assists'}` : ''} · ${x.auto ? autoLine(x) : x.hit ? (x.won ? 'he scored when it mattered' : 'his goal wasn\'t enough') : 'the chance went begging'}`}{x.swing ? <> · {x.swing}</> : null}</small>
          </div>
        )}
        {po.stage === 'done'
          ? <button className="ag-btn ag-btn--gold tk-intro-go" onClick={onBook}>WRAP THE SEASON <IconArrow size={16} /></button>
          : <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setStep('card'); sfx('tap') }}>THE NEXT ONE <IconArrow size={16} /></button>}
      </div>
    )
  }
  if (step === 'game') return (
    <div className="cr-po">
      <div className="cr-po-head"><span className="ag-eyebrow">{rd.name.toUpperCase()} · {rd.legs === 2 ? (sit.leg === 1 ? 'FIRST LEG · ' : 'SECOND LEG · ') : ''}VS {rd.oppName.toUpperCase()}</span><small className="cr-po-stakes">{sit.line}{sit.tail ? ` ${sit.tail}` : ''}{odds ? ` Score: about ${pct(odds.hit)}% to ${rd.final ? 'lift the trophy' : 'go through'}. Miss it: about ${pct(odds.miss)}%.` : ''}</small></div>
      <CareerGame home={rd.home === false ? 'opp' : 'team'} c={c} setCareer={setCareer} team={rd.intl ? natTeam(c.nation) : c.fit} pos={combinePos(c)} opp={oppOf(rd)} cast={gameCast(c, rd.opp, !!rd.intl)} situation={sit} key={`${po.idx}-${game}`} game={game} build={c.build} seed={`${c.seed}-${c.year}-${po.idx}`} lock={`${c.seed}-${c.year}-${po.idx}`} onDone={res => { setCareer(playoffRound(c, res.score, game, res.hit, res.raw ?? null)); setStep('result') }} />
    </div>
  )
  return (
    <div className="cr-po">
      <div className="ag-card cr-po-card ag-pop">
        <span className="ag-eyebrow">{rd.compName.toUpperCase()} · <span className="cr-nb">{rd.stage.toUpperCase()}</span>{rd.legs === 2 ? <> · <span className="cr-nb">TWO LEGS</span></> : null}</span>
        {rd.group && <p className="cr-note">{rd.year} {rd.compName}: {nationName(c.nation)} come through the group, {rd.group.w}–{rd.group.d}–{rd.group.l} with {rd.group.pts} {rd.group.pts === 1 ? 'point' : 'points'}. The knockouts start here.</p>}
        <div className="cr-po-match"><Crest r={rd} short={usOf(rd)} /><b>{usOf(rd)}</b><i>vs</i><b>{rd.opp}</b><Crest r={rd} short={rd.opp} ex={rd.extra} /></div>
        <small>{rd.oppName} · {rd.legs === 2 ? (rd.home ? 'Second leg at home' : 'Second leg away') : rd.home == null ? (rd.venue ? `At ${rd.venue}` : 'A neutral venue') : rd.home ? 'At home' : 'Away'}{rd.track === 'promo' ? (rd.up ? ' · the winner goes up' : rd.stay ? ' · the loser goes down' : '') : null}{rd.final && !simmed ? <> · it comes down to one moment</> : null}</small>
        {simmed && <small className="cr-po-sim">{rd.close === false ? `No key moment for ${c.name} in this one: the tie is simulated.` : 'Key moments are off: the tie is simulated.'}</small>}
        <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { sfx('whistle'); if (rd.close === false) { setCareer(playoffRound(c, 0.5)); setStep('result') } else setStep('game') }}>{simmed ? (rd.final ? 'SIMULATE THE FINAL' : 'SIMULATE THE TIE') : rd.final ? 'PLAY THE FINAL' : 'PLAY THE TIE'} <IconArrow size={16} /></button>
      </div>
      {po.line.length > 0 && <div className="cr-goals">{po.line.map(x => <span key={x.name} className={`cr-goal${x.won ? ' is-met' : ' is-miss'}`}>{x.name}: {x.won ? 'W' : 'L'} {x.mySc}–{x.oppSc}</span>)}</div>}
    </div>
  )
}
