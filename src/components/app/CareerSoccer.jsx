// CAREER, SOCCER's own screens: the season recap (the World Cup, his country), the transfer window, the
// season-by-season table, the Ballon d'Or banners and the big nights. Loaded only for a soccer career
// (AppCareer.jsx lazy-loads them), so football and basketball never download them.
import { useEffect, useRef, useState } from 'react'
import { sportOf, openTalks, acceptTalks, roundOdds, playoffRound, combinePos, gameCast, gamesMode } from '../../lib/career'
import { wageText, feeText, nationName, stayPut } from '../../lib/careerSoccer'
import { soccerLeagueInfo } from '../../utils/soccerSimulation'
import { sfx } from '../../lib/juice'
import { IconArrow, IconTrophy, IconStar, IconCrown, IconMedal, IconFlame, IconCheck, IconCaret } from './icons'
import { Analytics, CareerGame, honorsOf, fmt, ClubLogo, tieText, seasonOf, ordinalOf, inLeague } from './AppCareer'
import './squad-soccer.css'   // (the league table's rows: Squad Builder's soccer season, .sq-table)

// ── The league table ─────────────────────────────────────────────────────────
// Rows are the season engine's standings: { short, name, played, wins, draws, losses, gf, ga, gd, points, pos, isUs }.
const byTable = (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || (a.isUs ? -1 : b.isUs ? 1 : 0)
// The table as it stands after his club's matches so far, the truest source first:
//   1. the engine's own: S.x.table(c) (lib/careerSoccer.js: every club's results matchweek by matchweek, his club's as
//      they were really played; each row carries its zone), or rows kept on the career (c.active.table)
//   2. the league done: the final table (c.active.final.standings)
//   3. neither (a build or a season from before the engine's table): the season's simulated final table brought back
//      to the matches played, his club's row from its real results (an estimate: the other clubs' rows move when the
//      season is re-simulated)
export function tableNow(c, games = []) {
  const a = c.active
  if (!a) return null
  let own = null
  try { own = sportOf(c).x?.table?.(c) ?? a.table ?? null } catch { own = null }
  if (Array.isArray(own) && own.length) return own
  if (a.final?.standings?.length) return a.final.standings
  const k = games.length
  if (!k) return null
  const src = a.snap?.last?.standings ?? a.base?.standings
  if (!src?.length) return null
  const rows = src.map(r => {
    if (r.isUs || r.short === c.team) {
      const wins = games.filter(g => g.won).length, draws = games.filter(g => g.drawn).length
      const gf = games.reduce((n, g) => n + (g.mySc ?? 0), 0), ga = games.reduce((n, g) => n + (g.oppSc ?? 0), 0)
      return { ...r, isUs: true, played: k, wins, draws, losses: k - wins - draws, gf, ga, gd: gf - ga, points: wins * 3 + draws }
    }
    const f = k / Math.max(1, r.played ?? 38)
    const wins = Math.min(k, Math.round(r.wins * f)), draws = Math.min(k - wins, Math.round(r.draws * f))
    const gf = Math.round(r.gf * f), ga = Math.round(r.ga * f)
    return { ...r, played: k, wins, draws, losses: k - wins - draws, gf, ga, gd: gf - ga, points: wins * 3 + draws }
  }).sort(byTable)
  rows.forEach((r, i) => { r.pos = i + 1 })
  return rows
}
// a season's own table (the recap's), kept small on the season: [short, W, D, L, GF, GA] in table order (AppCareer's
// withTable), or the engine's full rows
const unpackTable = (S, list, mine) => (list ?? []).map((r, i) => (Array.isArray(r) ? { short: r[0], name: r[6] ?? S.teamOf(r[0])?.name ?? r[0], extra: r[6] != null, played: r[1] + r[2] + r[3], wins: r[1], draws: r[2], losses: r[3], gf: r[4], ga: r[5], gd: r[4] - r[5], points: r[1] * 3 + r[2], pos: i + 1, isUs: r[0] === mine } : { ...r, pos: r.pos ?? i + 1, isUs: r.isUs ?? r.short === mine }))
const seasonTable = (S, s) => { let rows = null; try { rows = S.x?.tableOf?.(s) ?? null } catch { rows = null } return rows?.length ? rows : unpackTable(S, s.table, s.team) }
// where a place in the table leads: the Champions League, the Europa League, the Conference League, the drop
// (the places are the league's own: utils/soccerSimulation.js soccerLeagueInfo; uecl when the league has them)
// (the engine's rows carry their own zone: those five, and in a second tier 'up' and 'playoff')
const ZONE_WORD = { ucl: 'Champions League', uel: 'Europa League', uecl: 'Conference League', up: 'Promotion', playoff: 'Play-off', down: 'Relegation' }
const ZONES = Object.keys(ZONE_WORD)
const zoneOfRow = (r, i, byPlace) => (r.zone !== undefined ? (ZONES.includes(r.zone) ? r.zone : null) : byPlace(r.pos ?? i + 1))
function zonesOf(league, size) {
  const info = soccerLeagueInfo(league) ?? { ucl: 4, uel: 2, down: 3 }
  const ucl = info.ucl ?? 4, uel = info.uel ?? 0, uecl = info.uecl ?? 0, down = info.down ?? 3
  return pos => (pos <= ucl ? 'ucl' : pos <= ucl + uel ? 'uel' : pos <= ucl + uel + uecl ? 'uecl' : pos > size - down ? 'down' : null)
}
// The table: the top four, his club's place and the bottom three, FULL TABLE a tap away (the whole of it when `all`)
export function LeagueTable({ c, rows, league, mine = c.team, all: all0 = false }) {
  const S = sportOf(c)
  const [all, setAll] = useState(all0)
  if (!rows?.length) return null
  const size = rows.length
  const me = rows.findIndex(r => r.isUs || r.short === mine)
  const zone = zonesOf(league, size)
  const shown = all ? rows : rows.filter((r, i) => i < 4 || Math.abs(i - me) <= 1 || i >= size - 3)
  const zones = ZONES.filter(z => rows.some((r, i) => zoneOfRow(r, i, zone) === z))
  return (
    <div className="cr-lt">
      <div className="sq-table" role="table" aria-label="League table">
        <div className="sq-table-row sq-table-head" role="row"><span>#</span><span>CLUB</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>PTS</span></div>
        {shown.map((r, j) => {
          const i = rows.indexOf(r), z = zoneOfRow(r, i, zone)
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
export function SoccerTable({ c, games, final = null }) {
  const done = !!final?.length || !!c.active?.final
  const [open, setOpen] = useState(false)
  // (nothing to show before a ball is kicked; the engine's rows, zones and all, ahead of the bare final standings)
  const live = games.length || done ? tableNow(c, games) : null
  const rows = live?.length && live[0].zone !== undefined ? live : final?.length ? final : live
  if (!rows?.length) return null
  const S = sportOf(c)
  const me = rows.find(r => r.isUs || r.short === c.team)
  const league = c.active?.base?.league?.id ?? S.teamOf(c.team)?.league
  const z = me ? zoneOfRow(me, rows.indexOf(me), zonesOf(league, rows.length)) : null
  const bar = (
    <button type="button" className={`cr-race-bar cr-lt-bar${open ? ' is-open' : ''}`} onClick={() => { setOpen(o => !o); sfx('tap') }} aria-expanded={open}>
      <span><small>{done ? 'FINAL TABLE' : 'THE TABLE'}</small><b>{me ? ordinalOf(me.pos).toUpperCase() : '—'}</b></span>
      {me && <span><small>PTS</small><b>{me.points}</b></span>}
      {z && <span className={`cr-lt-zone is-${z}`}><i />{z === 'down' ? 'RELEGATION ZONE' : `${ZONE_WORD[z].toUpperCase()} PLACE`}</span>}
      <IconCaret dir={open ? 'up' : 'down'} size={14} />
    </button>
  )
  if (!open) return bar
  return <div className="cr-race cr-lt-wrap ag-pop">{bar}<LeagueTable c={c} rows={rows} league={league} /></div>
}


export function SoccerRecap({ c, last, card, shareSeason }) {
  const S = sportOf(c)
  const met = (last.goals ?? []).filter(g => g.met).length
  const st = last.stats
  const wc = last.wc
  const bdo = last.bdo
  return (
    <div className={`ag-card cr-wrap ag-pop${last.trophies?.length ? ' is-ring' : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow"><span className="cr-nb">{seasonOf(last.season)}</span> · {ordinalOf(last.pos).toUpperCase()} IN {inLeague(last.league).toUpperCase()} · <span className="cr-nb">{last.wins}–{last.draws}–{last.losses}</span></span>{last.trophies?.length > 0 && <span className="cr-ring"><IconTrophy size={13} /> {last.trophies.length === 1 ? 'TROPHY' : `${last.trophies.length} TROPHIES`}</span>}</div>
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
        {last.role !== 'Starter' && <span className="cr-badge">{String(last.role ?? '').toUpperCase()}</span>}
        {last.records.map((r, i) => <span key={i} className="cr-badge is-rec"><IconFlame size={12} /> {r}</span>)}
      </div>
      <div className="cl-season-notes">
        {last.cupName && <p><b>{last.cupName}</b> {last.cupResult === 'Winners' ? 'Winners' : last.cupResult === 'Runners-up' ? 'Beaten in the final' : last.cupResult ? `Out in the ${String(last.cupResult).toLowerCase()}` : '—'}</p>}
        {last.europe && <p><b>{last.europe.name}</b> {last.europe.result === 'Winners' ? 'Winners' : last.europe.result === 'Runners-up' ? 'Beaten in the final' : `Out in the ${String(last.europe.result ?? 'league phase').toLowerCase()}`}</p>}
        {last.rounds?.length > 0 && <p><b>The big nights</b> {last.rounds.map(r => `${r.won ? 'W' : 'L'} ${tieText(r)} ${r.opponent}`).join(' · ')}</p>}
        {bdo && !last.award && bdo.winner && bdo.rank <= 10 && <p><b>Ballon d'Or</b> {ordinalOf(bdo.rank)}. Won by {bdo.winner.name}.</p>}
        {last.relegated && <p><b>Relegated</b> {last.teamName} go down.</p>}
        {last.qualified && <p><b>Next season</b> {last.qualified === 'ucl' ? 'The Champions League' : last.qualified === 'uel' ? 'The Europa League' : 'The Conference League'}</p>}
        <p><b>{nationName(c.nation)}</b> {last.caps ? `${last.caps} ${last.caps === 1 ? 'cap' : 'caps'}, ${last.intlGoals} ${last.intlGoals === 1 ? 'goal' : 'goals'}${last.intlRole && last.intlRole !== 'Starter' ? ` (${last.intlRole.toLowerCase()})` : ''}` : 'Not called up'}</p>
        {last.missed > 0 && <p><b>Missed</b> {last.missed} {last.missed === 1 ? 'match' : 'matches'}</p>}
      </div>
      {[wc, last.cont].filter(Boolean).map(t => <Tournament key={t.name ?? 'wc'} t={t} />)}
      {last.table?.length > 0 && (
        <div className="cr-lt-card">
          <span className="ag-eyebrow">{String(last.league ?? 'THE LEAGUE').toUpperCase()} · THE FINAL TABLE</span>
          <LeagueTable c={c} rows={seasonTable(S, last)} league={last.leagueId ?? last.league} mine={last.team} />
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
      {t.qualified === false ? <p className="cr-note">{nationName(t.nation)} didn't qualify.</p>
        : !t.called ? <p className="cr-note">Left out of the squad. He watches it at home.</p> : <>
          <b className="cr-wc-finish">{t.champion ? (t.name ? 'WINNERS' : 'WORLD CHAMPIONS') : String(t.finish ?? '').toUpperCase()}</b>
          <p className="cr-note">{t.goals} {t.goals === 1 ? 'goal' : 'goals'}, {t.assists} {t.assists === 1 ? 'assist' : 'assists'} in {t.apps} {t.apps === 1 ? 'match' : 'matches'}{t.boot?.won ? '. The Golden Boot.' : t.boot?.winner ? `. The Golden Boot went to ${t.boot.winner}.` : '.'}{t.ball ? ` The ${t.ball}.` : ''}{t.young ? ' Best Young Player.' : ''}</p>
          <div className="cr-goals">{(t.games ?? []).map((g, i) => <span key={i} className={`cr-goal${g.won ? ' is-met' : g.drawn && !g.pens ? '' : ' is-miss'}`}>{g.stage === 'group' ? 'Group' : g.round ?? g.stage}: {g.mySc}–{g.oppSc}{g.pens ? ` (${g.pens[0]}–${g.pens[1]} pens)` : ''} {g.oppName ?? g.opp}{g.goals ? ` · ${g.goals}G` : ''}</span>)}</div>
        </>}
    </div>
  )
}
// The summer window: bids from other clubs, a new deal, a loan; out of contract, the clubs that want him on a free
const OFFER_TAG = { bid: 'BID', loan: 'LOAN', renew: 'NEW DEAL', stay: 'STAY', contender: 'CONTENDER', payer: 'TOP WAGES', late: 'LATE OFFER' }
export function SoccerWindow({ c, setCareer, noCalls }) {
  const S = sportOf(c)
  if (noCalls) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">OUT OF CONTRACT</span><p className="cr-note">Out of contract at {c.age}, and no club calls. That's a career.</p></div>
  if (!c.offers?.length) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">THE WINDOW SHUTS</span><p className="cr-note">{c.decisions[c.decisions.length - 1]?.text ?? `Staying at ${c.fit?.name}.`}</p></div>
  const free = c.contract.left <= 0
  return (
    <div className="cr-offers ag-pop">
      <span className="ag-eyebrow">{free ? 'OUT OF CONTRACT' : 'THE TRANSFER WINDOW'} · {c.offers.length} {c.offers.length === 1 ? 'OFFER' : 'OFFERS'} · TAP ONE TO TALK</span>
      {c.offers.map(o => (
        <button key={`${o.kind}-${o.team}`} className={`cr-offer${o.kind === 'contender' ? ' is-contender' : ''}`} onClick={() => { setCareer(o.kind === 'loan' ? signOfferNow(c, o) : openTalks(c, o)); sfx('tap') }}>
          <ClubLogo S={S} short={o.team} />
          <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{OFFER_TAG[o.kind] ?? 'OFFER'}{o.fee ? ` · ${feeText(o.fee, c.team)} fee` : ''} · {o.stand ? (o.stand.starter ? 'First choice' : `${o.stand.role ? `${o.stand.role}, b` : 'B'}ehind ${o.stand.behind}`) : o.fit.status} · {o.fit.conf}</i></span>
          <span className="cr-offer-money"><b>{wageText(o.perYear, o.team).replace(' a week', '')}</b><small>A WEEK · {o.years} {o.years === 1 ? 'YR' : 'YRS'}</small></span>
        </button>
      ))}
      {!free && <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(stayPut(c)); sfx('tap') }}>STAY PUT · {c.contract.left} {c.contract.left === 1 ? 'YEAR' : 'YEARS'} LEFT AT {String(c.fit?.name ?? '').toUpperCase()}</button>}
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
// The big nights: the European knockouts and the cup final, one tie at a time (a close one turns on a key moment)
export function SoccerNights({ c, setCareer, onBook, step, setStep, game, sit }) {
  const S = sportOf(c)
  const po = c.active.po
  const rd = po.rounds[po.idx]
  const last = po.line[po.line.length - 1]
  const oppOf = r => (r.extra ? { short: r.opp, name: r.oppName, color: '#3f3f46', color2: '#e4e4e7' } : S.teamOf(r.opp))
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
              {[[c.team, x.mySc, x.won, false], [x.opp, x.oppSc, !x.won, x.extra]].map(([t, sc, up, ex]) => (
                <div key={t} className={`cr-po-side${up ? ' is-up' : ''}`} style={{ '--tc': ex ? '#3f3f46' : S.teamOf(t)?.color ?? '#26302c' }}>
                  <ClubLogo S={S} short={t} extra={ex} />
                  <small>{t}</small>
                  <b>{sc}</b>
                </div>
              ))}
            </div>
            <b>{x.won ? (x.final ? `${x.compName} winners.` : `Through to the ${nextOf(x)?.stage?.toLowerCase() ?? 'next round'}.`) : x.final ? `Beaten in the ${x.compName} final.` : `Out of the ${x.compName} in the ${String(x.stage).toLowerCase()}.`}</b>
            <small>{tieText(x)}{x.sat ? ' · watched from the stand' : ` · ${x.goals ? `${x.goals} ${x.goals === 1 ? 'goal' : 'goals'}` : 'no goal'}${x.assists ? `, ${x.assists} ${x.assists === 1 ? 'assist' : 'assists'}` : ''} · ${x.auto ? (x.won ? 'never in doubt' : 'never close') : x.hit ? (x.won ? 'he scored when it mattered' : 'his goal wasn\'t enough') : 'the chance went begging'}`}{x.swing ? <> · {x.swing}</> : null}</small>
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
      <div className="cr-po-head"><span className="ag-eyebrow">{rd.name.toUpperCase()} · {rd.legs === 2 ? 'SECOND LEG · ' : ''}VS {rd.oppName.toUpperCase()}</span><small className="cr-po-stakes">{sit.line}{sit.tail ? ` ${sit.tail}` : ''}{odds ? ` Score: about ${pct(odds.hit)}% to ${rd.final ? 'lift the trophy' : 'go through'}. Miss it: about ${pct(odds.miss)}%.` : ''}</small></div>
      <CareerGame home={rd.home === false ? 'opp' : 'team'} c={c} setCareer={setCareer} team={c.fit} pos={combinePos(c)} opp={oppOf(rd)} cast={gameCast(c, rd.opp)} situation={sit} key={`${po.idx}-${game}`} game={game} build={c.build} seed={`${c.seed}-${c.year}-${po.idx}`} lock={`${c.seed}-${c.year}-${po.idx}`} onDone={res => { setCareer(playoffRound(c, res.score, game, res.hit, res.raw ?? null)); setStep('result') }} />
    </div>
  )
  return (
    <div className="cr-po">
      <div className="ag-card cr-po-card ag-pop">
        <span className="ag-eyebrow">{rd.compName.toUpperCase()} · <span className="cr-nb">{rd.stage.toUpperCase()}</span>{rd.legs === 2 ? <> · <span className="cr-nb">TWO LEGS</span></> : null}</span>
        <div className="cr-po-match"><ClubLogo S={S} short={c.team} /><b>{c.team}</b><i>vs</i><b>{rd.opp}</b><ClubLogo S={S} short={rd.opp} extra={rd.extra} /></div>
        <small>{rd.oppName} · {rd.legs === 2 ? (rd.home ? 'Second leg at home' : 'Second leg away') : 'A neutral venue'}{rd.final && !simmed ? <> · it comes down to one moment</> : null}</small>
        {simmed && <small className="cr-po-sim">{rd.close === false ? `No key moment for ${c.name} in this one: the tie is simulated.` : 'Key moments are off: the tie is simulated.'}</small>}
        <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { sfx('whistle'); if (rd.close === false) { setCareer(playoffRound(c, 0.5)); setStep('result') } else setStep('game') }}>{simmed ? (rd.final ? 'SIMULATE THE FINAL' : 'SIMULATE THE TIE') : rd.final ? 'PLAY THE FINAL' : 'PLAY THE TIE'} <IconArrow size={16} /></button>
      </div>
      {po.line.length > 0 && <div className="cr-goals">{po.line.map(x => <span key={x.name} className={`cr-goal${x.won ? ' is-met' : ' is-miss'}`}>{x.name}: {x.won ? 'W' : 'L'} {x.mySc}–{x.oppSc}</span>)}</div>}
    </div>
  )
}
