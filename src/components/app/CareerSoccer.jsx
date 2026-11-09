// CAREER, SOCCER's own screens: the season recap (the World Cup, his country), the transfer window, the
// season-by-season table, the Ballon d'Or banners and the big nights. Loaded only for a soccer career
// (AppCareer.jsx lazy-loads them), so football and basketball never download them.
import { useState } from 'react'
import { sportOf, openTalks, acceptTalks, momentOdds, playoffRound, combinePos, gameCast } from '../../lib/career'
import { wageText, feeText, nationName, stayPut } from '../../lib/careerSoccer'
import { sfx } from '../../lib/juice'
import { IconArrow, IconTrophy, IconStar, IconCrown, IconMedal, IconFlame, IconCheck } from './icons'
import { Analytics, CareerGame, honorsOf, fmt, ClubLogo, tieText, seasonOf, ordinalOf, inLeague } from './AppCareer'

export function SoccerRecap({ c, last, card, shareSeason }) {
  const S = sportOf(c)
  const met = (last.goals ?? []).filter(g => g.met).length
  const st = last.stats
  const wc = last.wc
  const bdo = last.bdo
  return (
    <div className={`ag-card cr-wrap ag-pop${last.trophies?.length ? ' is-ring' : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow">{seasonOf(last.season)} · {ordinalOf(last.pos)} IN {inLeague(last.league).toUpperCase()} · {last.wins}–{last.draws}–{last.losses}</span>{last.trophies?.length > 0 && <span className="cr-ring"><IconTrophy size={13} /> {last.trophies.length === 1 ? 'TROPHY' : `${last.trophies.length} TROPHIES`}</span>}</div>
      <div className="cr-wrap-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[[st.goals, 'GOALS'], [st.assists, 'ASSISTS'], [st.apps, 'APPS'], [st.lgGoals, 'LEAGUE G'], [st.xg, 'LEAGUE xG'], [st.avgRating ? st.avgRating.toFixed(2) : '—', 'RATING']].map(([v, k]) => <span key={k}><b>{typeof v === 'number' ? fmt(v) : v}</b><small>{k}</small></span>)}
      </div>
      <div className="cr-badges">
        {(last.trophies ?? []).map(t => <span key={t} className="cr-badge is-gold"><IconTrophy size={12} /> {t.toUpperCase()}</span>)}
        {wc?.champion && <span className="cr-badge is-gold"><IconTrophy size={12} /> WORLD CUP</span>}
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
      {wc && (
        <div className={`ag-card cr-wc${wc.champion ? ' is-ring' : ''}`}>
          <span className="ag-eyebrow">THE {wc.year} WORLD CUP · {nationName(wc.nation).toUpperCase()}</span>
          {!wc.called ? <p className="cr-note">Left out of the squad. He watches it at home.</p> : <>
            <b className="cr-wc-finish">{wc.champion ? 'WORLD CHAMPIONS' : String(wc.finish ?? '').toUpperCase()}</b>
            <p className="cr-note">{wc.goals} {wc.goals === 1 ? 'goal' : 'goals'}, {wc.assists} {wc.assists === 1 ? 'assist' : 'assists'} in {wc.apps} {wc.apps === 1 ? 'match' : 'matches'}{wc.boot?.won ? '. The Golden Boot.' : wc.boot?.winner ? `. The Golden Boot went to ${wc.boot.winner}.` : '.'}{wc.ball ? ` The ${wc.ball}.` : ''}{wc.young ? ' Best Young Player.' : ''}</p>
            <div className="cr-goals">{(wc.games ?? []).map((g, i) => <span key={i} className={`cr-goal${g.won ? ' is-met' : g.drawn && !g.pens ? '' : ' is-miss'}`}>{g.stage === 'group' ? 'Group' : g.round ?? g.stage}: {g.mySc}–{g.oppSc}{g.pens ? ` (${g.pens[0]}–${g.pens[1]} pens)` : ''} {g.oppName ?? g.opp}{g.goals ? ` · ${g.goals}G` : ''}</span>)}</div>
          </>}
        </div>
      )}
      <Analytics c={c} s={last} />
      {last.goals.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">GOALS · {met}/{last.goals.length}</span>{last.goals.map(g => <span key={g.k} className={`cr-goal${g.met ? ' is-met' : ' is-miss'}`}>{g.met ? <IconCheck size={11} /> : null} {g.label}</span>)}</div>}
      <button className="ag-btn ag-btn--ghost cl-season-share" onClick={shareSeason} disabled={card.busy}>{card.busy ? 'MAKING THE CARD…' : `SHARE THE ${seasonOf(last.season)} SEASON`}</button>
      {card.img && <img src={card.img} alt={`${c.name}'s ${last.season} season card`} className="cl-preview" />}
      {card.img && <a className="ag-btn ag-btn--ghost cl-season-share" href={card.img} download={`season-${last.season}.png`}>SAVE THE IMAGE</a>}
      {card.failed && <p className="cr-note">{card.img ? "Couldn't open sharing here. Save the image instead." : "Couldn't make the card. Try again."}</p>}
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
const KO_DEPTH_UI = { 'Knockout play-off': 0, 'Round of 16': 0, 'Quarter-final': 1, 'Semi-final': 2, Final: 3 }
export function SoccerNights({ c, setCareer, onBook, step, setStep, game, sit }) {
  const S = sportOf(c)
  const po = c.active.po
  const rd = po.rounds[po.idx]
  const last = po.line[po.line.length - 1]
  const oppOf = r => (r.extra ? { short: r.opp, name: r.oppName, color: '#3f3f46', color2: '#e4e4e7' } : S.teamOf(r.opp))
  const missIt = Math.round(momentOdds(rd?.p ?? 0.5, false, 0.75, KO_DEPTH_UI[rd?.stage] ?? 3) * 100)
  if (po.stage === 'done' || step === 'result') {
    const x = last
    const nextOf = x => { const i = po.rounds.findIndex(r => r.name === x.name); return po.rounds.slice(i + 1).find(r => r.track === x.track && !r.skip) }
    return (
      <div className="cr-po">
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
            <small>{tieText(x)}{x.sat ? ' · watched from the stand' : ` · ${x.goals ? `${x.goals} ${x.goals === 1 ? 'goal' : 'goals'}` : 'no goal'}${x.assists ? `, ${x.assists} ${x.assists === 1 ? 'assist' : 'assists'}` : ''} · ${x.auto ? (x.won ? 'never in doubt' : 'never close') : x.hit ? 'he scored when it mattered' : 'the chance went begging'}`}{x.swing ? <> · {x.swing}</> : null}</small>
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
      <div className="cr-po-head"><span className="ag-eyebrow">{rd.name.toUpperCase()} · {rd.legs === 2 ? 'SECOND LEG · ' : ''}VS {rd.oppName.toUpperCase()}</span><small className="cr-po-stakes">{rd.legs === 2 ? 'Level on aggregate after the first leg. ' : ''}{sit.line}{sit.tail ? ` ${sit.tail}` : ''} Score and {rd.final ? 'the trophy is theirs' : 'they’re through'}. Miss it: about {missIt}% they still find a way.</small></div>
      <CareerGame home={rd.home === false ? 'opp' : 'team'} retry c={c} setCareer={setCareer} team={c.fit} pos={combinePos(c)} opp={oppOf(rd)} cast={gameCast(c, rd.opp)} situation={sit} key={`${po.idx}-${game}`} game={game} build={c.build} seed={`${c.seed}-${c.year}-${po.idx}`} lock={`${c.seed}-${c.year}-${po.idx}`} onDone={res => { setCareer(playoffRound(c, res.score, game, res.hit, res.raw?.pts ?? null)); setStep('result') }} />
    </div>
  )
  return (
    <div className="cr-po">
      <div className="ag-card cr-po-card ag-pop">
        <span className="ag-eyebrow">{rd.compName.toUpperCase()} · {rd.stage.toUpperCase()}{rd.legs === 2 ? ' · TWO LEGS' : ''}</span>
        <div className="cr-po-match"><ClubLogo S={S} short={c.team} /><b>{c.team}</b><i>vs</i><b>{rd.opp}</b><ClubLogo S={S} short={rd.opp} extra={rd.extra} /></div>
        <small>{rd.oppName} · {rd.legs === 2 ? (rd.home ? 'Second leg at home' : 'Second leg away') : 'A neutral venue'}{rd.final ? <> · it comes down to one moment</> : null}</small>
        <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { sfx('whistle'); if (rd.close === false) { setCareer(playoffRound(c, 0.5)); setStep('result') } else setStep('game') }}>{rd.final ? 'PLAY THE FINAL' : 'PLAY THE TIE'} <IconArrow size={16} /></button>
      </div>
      {po.line.length > 0 && <div className="cr-goals">{po.line.map(x => <span key={x.name} className={`cr-goal${x.won ? ' is-met' : ' is-miss'}`}>{x.name}: {x.won ? 'W' : 'L'} {x.mySc}–{x.oppSc}</span>)}</div>}
    </div>
  )
}
