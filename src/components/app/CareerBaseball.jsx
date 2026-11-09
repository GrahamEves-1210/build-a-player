// CAREER, BASEBALL's own screens: the season recap (the line, the honors, the All-Star break, October), club control
// and free agency, the season-by-season table, the banners (rings, MVPs and Cy Youngs), the lineup and the staff, a
// run of games, and the postseason series by series. Loaded only for a baseball career (AppCareer.jsx lazy-loads
// them), so football, basketball and soccer never download them. The player is always his own name, never "You".
import { useMemo, useState } from 'react'
import { sportOf, openTalks, playoffRound, combinePos, gameCast, lineup, depthChart, cardOdds, gradeOf, ovrGradeVal, FACE_RATING } from '../../lib/career'
import { sfx } from '../../lib/juice'
import { IconArrow, IconTrophy, IconStar, IconCrown, IconMedal, IconFlame, IconCheck, IconRing } from './icons'
import { Analytics, CareerGame, honorsOf, fmt } from './AppCareer'
import { SIMPLE_GAMES } from '../../lib/minigamesSimple'
import { gamesMode } from '../../lib/career'

const bx = () => sportOf({ sport: 'baseball' }).x
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('')
const shortName = n => { const p = (n || '').split(' '); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : n }
const gradeColor = v0 => { const v = Math.round(v0 ?? 0); return v >= 11 ? '#a855f7' : v >= 8 ? '#3b82f6' : v >= 5 ? '#22c55e' : v >= 2 ? '#eab308' : v >= 1 ? '#f97316' : '#ef4444' }
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const r3 = v => bx().rate3(v)
const ip = outs => bx().ipText(outs)
const f2 = v => (v == null ? '—' : Number(v).toFixed(2))
const f1 = v => (v == null ? '—' : Number(v).toFixed(1))
const isRel = st => (st?.gs ?? 0) < (st?.gp ?? 0) / 2
// a season's line in the columns a baseball page uses
const BAT_CELLS = st => [[st.gp, 'G'], [st.ab, 'AB'], [st.h, 'H'], [st.hr, 'HR'], [st.rbi, 'RBI'], [r3(st.avg), 'AVG'], [r3(st.ops), 'OPS'], [f1(st.war), 'WAR']]
const PIT_CELLS = st => (isRel(st)
  ? [[`${st.w}-${st.l}`, 'W-L'], [f2(st.era), 'ERA'], [st.gp, 'G'], [st.sv, 'SV'], [ip(st.outs), 'IP'], [st.k, 'K'], [f2(st.whip), 'WHIP'], [f1(st.war), 'WAR']]
  : [[`${st.w}-${st.l}`, 'W-L'], [f2(st.era), 'ERA'], [st.gs, 'GS'], [ip(st.outs), 'IP'], [st.k, 'K'], [f2(st.whip), 'WHIP'], [f2(st.fip), 'FIP'], [f1(st.war), 'WAR']])
const cellsOf = (c, st) => (c.pos === 'pit' ? PIT_CELLS(st) : BAT_CELLS(st))
const ICON_OF = h => (/World Series champion/.test(h) ? IconRing : /MVP|Cy Young|Triple Crown/.test(h) ? IconTrophy : /Silver Slugger|Gold Glove|All-MLB|title|leader|Hank Aaron|Reliever/.test(h) ? IconMedal : IconStar)
const GOLD = h => /World Series champion|^MVP$|^Cy Young$|Triple Crown|World Series MVP|Rookie of the Year/.test(h)

// ── The season, booked ───────────────────────────────────────────────────────
export function BaseballRecap({ c, last, card, shareSeason }) {
  const st = last.stats
  const met = (last.goals ?? []).filter(g => g.met).length
  const X = bx()
  const hon = honorsOf(last, sportOf(c), c.pos)
  const place = last.champion ? 'WORLD SERIES CHAMPIONS' : last.pennant ? 'PENNANT' : last.playoffs ? (last.divWin ? `${String(last.divName ?? `${last.lg} DIVISION`).toUpperCase()} CHAMPIONS` : 'WILD CARD') : last.gb != null && last.gb > 0 ? `${last.gb} GAMES OUT` : 'NO POSTSEASON'
  return (
    <div className={`ag-card cr-wrap ag-pop${last.champion ? ' is-ring' : ''}`}>
      <div className="ag-card-head"><span className="ag-eyebrow">{last.season} · {last.wins}–{last.losses} · {place}</span>{last.champion && <span className="cr-ring"><IconRing size={13} /> CHAMPIONS</span>}</div>
      <div className="cr-wrap-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {cellsOf(c, st).map(([v, k]) => <span key={k}><b>{typeof v === 'number' ? fmt(v) : v}</b><small>{k}</small></span>)}
      </div>
      <div className="cr-badges">
        {hon.map(h => { const Ico = ICON_OF(h); return <span key={h} className={`cr-badge${GOLD(h) ? ' is-gold' : ''}`}><Ico size={12} /> {h.toUpperCase()}</span> })}
        {last.usage && <span className="cr-badge">{last.usage}</span>}
        {(last.records ?? []).map((r, i) => <span key={i} className="cr-badge is-rec"><IconFlame size={12} /> {r}</span>)}
      </div>
      <div className="cl-season-notes">
        {last.minors && <p><b>The minors</b> {last.minors.games} games at {X.levelName(last.minors.level)} before the call-up</p>}
        {last.rehab && <p><b>Rehab</b> {last.rehab.games} games on the injured list after {last.rehab.what}</p>}
        {last.rounds?.length > 0 && <p><b>October</b> {last.rounds.map(r => `${r.round}: ${r.won ? 'won' : 'lost'} ${Math.max(r.mySc, r.oppSc)}-${Math.min(r.mySc, r.oppSc)} vs ${String(r.opponent ?? '').split(' ').slice(-1)[0]}${r.moment?.n ? ` (${momentGameText(r.moment)})` : ''}`).join(' · ')}</p>}
        {last.allStar && <p><b>All-Star Game</b> {last.asgStart ? 'Voted in as a starter' : 'On the team'}{last.asgMvp ? ', and the game’s MVP' : ''}{last.derby ? `. Home Run Derby: ${last.derby.won ? `the champion, ${last.derby.hr} in the final round` : `${last.derby.hr} home runs, out in the ${last.derby.round}`}` : ''}</p>}
        {!last.mvp && last.mvpRank && <p><b>MVP voting</b> {ord(last.mvpRank)}</p>}
        {!last.cy && last.cyRank && <p><b>Cy Young voting</b> {ord(last.cyRank)}</p>}
        {last.poStats && <p><b>Postseason</b> {c.pos === 'pit' ? `${ip(last.poStats.outs)} IP, ${f2(last.poStats.era)} ERA, ${last.poStats.k} K${last.poStats.sv ? `, ${last.poStats.sv} SV` : ''}` : `${last.poStats.h}-for-${last.poStats.ab}, ${last.poStats.hr} HR, ${last.poStats.rbi} RBI`} in {last.poStats.games} {last.poStats.games === 1 ? 'series' : 'series'}</p>}
        {last.missed > 0 && <p><b>Missed</b> {last.missed} {last.missed === 1 ? 'game' : 'games'}</p>}
        {(last.milestones ?? []).length > 0 && <p><b>Milestones</b> {last.milestones.join(' · ')}</p>}
      </div>
      <Analytics c={c} s={last} />
      {last.goals?.length > 0 && <div className="cr-goals"><span className="ag-eyebrow">GOALS · {met}/{last.goals.length}</span>{last.goals.map(g => <span key={g.k} className={`cr-goal${g.met ? ' is-met' : ' is-miss'}`}>{g.met ? <IconCheck size={11} /> : null} {g.label}</span>)}</div>}
      <button className="ag-btn ag-btn--ghost cl-season-share" onClick={shareSeason} disabled={card.busy}>{card.busy ? 'MAKING THE CARD…' : `SHARE THE ${last.season} SEASON`}</button>
      {card.img && <img src={card.img} alt={`${c.name}'s ${last.season} season card`} className="cl-preview" />}
      {card.img && <a className="ag-btn ag-btn--ghost cl-season-share" href={card.img} download={`season-${last.season}.png`}>SAVE THE IMAGE</a>}
      {card.failed && <p className="cr-note">{card.img ? "Couldn't open sharing here. Save the image instead." : "Couldn't make the card. Try again."}</p>}
    </div>
  )
}

// ── Club control and free agency ─────────────────────────────────────────────
const OFFER_TAG = { ext: 'EXTENSION', stay: 'STAY', contender: 'CONTENDER', payer: 'TOP OFFER', years: 'MOST YEARS', late: 'LATE OFFER' }
export function BaseballContract({ c, setCareer, noCalls }) {
  const S = sportOf(c), X = bx()
  const svc = c.service ?? 0, arb = X.arbYear(svc), k = c.contract ?? {}
  if (noCalls) return <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">FREE AGENCY</span><p className="cr-note">The phone didn&apos;t ring. At {c.age}, with last season on the scouting reports, no club makes an offer. That&apos;s a career.</p></div>
  const control = k.kind === 'control' && k.left > 0
  const status = control ? (
    <div className="ag-card cr-offer-wrap ag-pop">
      <span className="ag-eyebrow">CLUB CONTROL · {svc.toFixed(3).replace(/\.?0+$/, '')} YEARS OF SERVICE</span>
      <p className="cr-note">{arb ? `Arbitration, year ${arb} of 3: ${X.money(k.perYear)} for next season.` : `Pre-arbitration: about the league minimum, ${X.money(k.perYear)}, until three years of service.`} {k.left === 1 ? 'One more season, then free agency.' : `${k.left} seasons of control left, then free agency.`}</p>
    </div>
  ) : null
  if (!c.offers?.length) return <>{status}{!control && <div className="ag-card cr-offer-wrap ag-pop"><span className="ag-eyebrow">SIGNED</span><p className="cr-note">{c.decisions[c.decisions.length - 1]?.text}</p></div>}</>
  const free = !control
  return (
    <>
      {status}
      <div className="cr-offers ag-pop">
        <span className="ag-eyebrow">{free ? 'FREE AGENCY' : 'AN EXTENSION OFFER'} · {c.offers.length} {c.offers.length === 1 ? 'OFFER' : 'OFFERS'} · TAP ONE TO TALK</span>
        {c.offers.map(o => (
          <button key={`${o.kind}-${o.team}`} className={`cr-offer${o.kind === 'contender' ? ' is-contender' : ''}`} onClick={() => { setCareer(openTalks(c, o)); sfx('tap') }}>
            <img src={S.logo(o.team)} alt="" />
            <span className="cr-offer-txt"><b>{o.fit.name}</b><small>{o.pitch}</small><i>{OFFER_TAG[o.kind] ?? 'OFFER'} · {o.stand ? (o.stand.starter ? o.stand.label : `${o.stand.label}, behind ${o.stand.behind}`) : o.fit.status} · {o.fit.status}</i></span>
            <span className="cr-offer-money"><b>{X.money(o.perYear)}</b><small>AAV · {o.years} {o.years === 1 ? 'YR' : 'YRS'} · {X.money(o.perYear * o.years)}</small></span>
          </button>
        ))}
        {!free && <button className="ag-btn ag-btn--ghost" onClick={() => { setCareer(X.stayPut(c)); sfx('tap') }}>GO YEAR TO YEAR{arb ? ' THROUGH ARBITRATION' : ''}</button>}
      </div>
    </>
  )
}

// ── Season by season ─────────────────────────────────────────────────────────
const BAT_COLS = [['gp', 'G'], ['ab', 'AB'], ['h', 'H'], ['hr', 'HR'], ['rbi', 'RBI'], ['sb', 'SB'], ['avg', 'AVG', r3], ['ops', 'OPS', r3], ['opsPlus', 'OPS+'], ['war', 'WAR', f1]]
const PIT_COLS = [['wl', 'W-L'], ['era', 'ERA', f2], ['gp', 'G'], ['gs', 'GS'], ['sv', 'SV'], ['outs', 'IP', ip], ['k', 'K'], ['whip', 'WHIP', f2], ['war', 'WAR', f1]]
const cell = (st, [k, , f]) => (k === 'wl' ? `${st.w ?? 0}-${st.l ?? 0}` : f ? f(st[k] ?? 0) : fmt(st[k] ?? 0))
export function BaseballSeasonTable({ c, t }) {
  const S = sportOf(c)
  const [open, setOpen] = useState(null)
  const flip = y => { setOpen(o => (o === y ? null : y)); sfx('tap') }
  const cols = c.pos === 'pit' ? PIT_COLS : BAT_COLS
  return (
    <div className="ag-card cr-seasons ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">SEASON BY SEASON · REGULAR SEASON</span></div>
      <div className="cr-seasons-scroll" tabIndex={0} role="region" aria-label="Season by season stats">
        <table>
          <thead><tr><th scope="col">YEAR</th><th scope="col">TEAM</th>{cols.map(([k, label]) => <th key={k} scope="col">{label}</th>)}<th scope="col" aria-label="Honors" /></tr></thead>
          <tbody>
            {c.seasons.map(s => [
              <tr key={s.year} className={`cr-seasons-row${s.champion ? ' is-ring' : ''}${open === s.year ? ' is-open' : ''}`} tabIndex={0} aria-expanded={open === s.year} onClick={() => flip(s.year)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(s.year) } }}>
                <th scope="row"><IconArrow size={10} className="cr-seasons-chev" />{s.season}</th>
                <td className="cr-seasons-team"><img src={S.logo(s.team)} alt="" loading="lazy" />{s.team}</td>
                {cols.map(col => <td key={col[0]}>{cell(s.stats, col)}</td>)}
                <td className="cr-seasons-ico">{s.champion && <IconRing size={13} />}{(s.mvp || s.cy) && <IconTrophy size={13} />}{s.allPro || s.ss ? <IconMedal size={13} /> : s.allStar ? <IconStar size={13} /> : null}</td>
              </tr>,
              open === s.year && (
                <tr key={`${s.year}-more`} className="cr-seasons-more"><td colSpan={cols.length + 3}><div className="cr-seasons-detail">
                  {honorsOf(s, S, c.pos).length > 0 && <p className="cr-seasons-honors">{honorsOf(s, S, c.pos).join(' · ')}</p>}
                  <p className="cr-seasons-honors">{s.teamName} · {s.wins}–{s.losses} · {s.usage}{s.minors ? ` · ${s.minors.games} games in the minors` : ''}</p>
                  <Analytics c={c} s={s} />
                </div></td></tr>
              ),
            ])}
          </tbody>
          <tfoot><tr><th scope="row">CAREER</th><td />{cols.map(col => <td key={col[0]}>{cell(t.stats, col)}</td>)}<td /></tr></tfoot>
        </table>
      </div>
    </div>
  )
}
// the career at a glance (the Career tab)
export function BaseballTotals({ c, t }) {
  const st = t.stats
  // (no innings or at-bats yet: the rates read as a dash, not 0.00)
  const none = c.pos === 'pit' ? !(st.outs > 0) : !(st.ab > 0), rate = (v, f) => (none ? '–' : f(v ?? 0))
  const cells = c.pos === 'pit'
    ? [[`${st.w ?? 0}-${st.l ?? 0}`, 'W-L'], [rate(st.era, f2), 'ERA'], [fmt(st.k ?? 0), 'STRIKEOUTS'], [fmt(st.sv ?? 0), 'SAVES'], [ip(st.outs ?? 0), 'INNINGS'], [rate(st.whip, f2), 'WHIP'], [f1(st.war), 'WAR'], [t.rings, 'RINGS'], [t.cys, 'CY YOUNGS'], [t.allStars, 'ALL-STARS'], [t.wsMvp, 'WS MVPS'], [t.mvps, 'MVPS']]
    : [[fmt(st.h ?? 0), 'HITS'], [fmt(st.hr ?? 0), 'HOME RUNS'], [rate(st.avg, r3), 'AVG'], [fmt(st.rbi ?? 0), 'RBI'], [fmt(st.sb ?? 0), 'STOLEN BASES'], [rate(st.ops, r3), 'OPS'], [f1(st.war), 'WAR'], [t.rings, 'RINGS'], [t.mvps, 'MVPS'], [t.allStars, 'ALL-STARS'], [t.ss, 'SILVER SLUGGERS'], [t.gg, 'GOLD GLOVES']]
  return <div className="cr-kv">{cells.map(([v, k]) => <span key={k}><b>{v}</b><small>{k}</small></span>)}</div>
}
// The banners: every ring, every MVP and Cy Young, and the plaque at Cooperstown
export function BaseballBanners({ c }) {
  const L = c.seasons.filter(s => s.champion || s.mvp || s.cy)
  const lg = s => (s.lg === 'NL' ? 'NL' : 'AL')
  return (
    <div className="cl-case cl-bdo">
      {c.hof?.in && <span className="cl-trophy is-gold"><IconCrown size={18} /><b>HOF</b><small>COOPERSTOWN{c.hof.ballot ? ` · ${String(c.hof.ballot).toUpperCase()}` : ''}</small></span>}
      {L.flatMap(s => [
        s.champion && <span key={`${s.year}-ws`} className="cl-trophy is-gold"><IconRing size={18} /><b>{s.season}</b><small>WORLD SERIES</small></span>,
        s.mvp && <span key={`${s.year}-mvp`} className="cl-trophy is-gold"><IconTrophy size={18} /><b>{s.season}</b><small>{lg(s)} MVP</small></span>,
        s.cy && <span key={`${s.year}-cy`} className="cl-trophy is-gold"><IconTrophy size={18} /><b>{s.season}</b><small>{lg(s)} CY YOUNG</small></span>,
      ].filter(Boolean))}
    </div>
  )
}

// ── The club: the batting order and the bench, or the rotation and the bullpen ──
export function BaseballLineup({ c }) {
  const S = sportOf(c), X = bx()
  const dc = useMemo(() => depthChart(c), [c.roster, c.ovr, c.name, c.lastRole, c.contract, c.pos, c.active?.k]) // eslint-disable-line react-hooks/exhaustive-deps
  const u = X.usageOf(c)
  const face = c.build?.[FACE_RATING[c.pos]]?.photo ?? null
  const Row = ({ p, tag }) => (
    <span className={`crl-depth${p.you ? ' is-you' : ''}`}>
      <i>{tag}</i>
      <b>{p.you ? c.name : p.name}</b>
      <small>{p.out ? <em className="crl-out">{p.out}</em> : `${p.ovr} OVR · age ${p.you ? c.age : p.age}`}</small>
    </span>
  )
  const Man = ({ p, slot }) => (
    <span className={`crl-man${p.you ? ' is-you' : ''}`}>
      <span className="crl-face">{p.you ? (face ? <img src={face} alt="" /> : <span className="crl-init">{initials(c.name)}</span>) : p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span className="crl-init">{initials(p.name)}</span>}<i style={{ background: gradeColor(ovrGradeVal(p.ovr)) }}>{p.ovr}</i></span>
      <b>{p.you ? c.name : shortName(p.name)}</b>
      <small>{slot}</small>
    </span>
  )
  if (c.pos === 'pit') {
    const ro = c.roster ?? {}
    const me = { name: c.name, ovr: c.ovr, age: c.age, you: true }
    const arms = (ro.pit ?? []).filter(p => p.name !== c.name)
    const isSP = p => X.roleOf(p, 'pit') === 'SP'
    const mine = X.pitRole(c) === 'SP'
    const rot = (mine ? dc.all : [...arms.filter(isSP)].sort((a, b) => b.ovr - a.ovr)).slice(0, 5)
    const pen = (mine ? [...arms.filter(p => !isSP(p))].sort((a, b) => b.ovr - a.ovr) : dc.all).slice(0, 7)
    void me
    return (
      <div className="ag-card crl ag-pop">
        <div className="ag-card-head"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()} · THE STAFF</span><span className={`crl-role${u.starter ? ' is-on' : ''}`}>{u.label}</span></div>
        <div className="crl-field crl-field--court">
          <div className="crl-row">{rot.map((p, i) => <Man key={p.name} p={p} slot={`SP${i + 1}`} />)}</div>
        </div>
        <div className="crl-bench">
          <span className="ag-eyebrow">THE BULLPEN</span>
          {pen.map((p, i) => <Row key={p.name + i} p={p} tag={i === 0 ? 'CL' : i <= 2 ? 'SU' : 'RP'} />)}
        </div>
        {!u.starter && dc.ahead.length > 0 && <p className="cr-note">{mine ? `Sixth in line for the rotation, behind ${dc.ahead[dc.ahead.length - 1].name}. An injury or a slump ahead of him and the ball is his every fifth day.` : `Behind ${dc.ahead[0].name} for the ninth inning. Get outs in the big spots and the job comes to ${c.name}.`}</p>}
      </div>
    )
  }
  const L = lineup(c)
  const nine = (L.bat ?? dc.all.slice(0, 9)).map((p, i) => ({ p, spot: [2, 3, 1, 4, 5, 6, 7, 8, 9][i] ?? i + 1 })).sort((a, b) => a.spot - b.spot)
  const bench = dc.all.slice(9)
  const posOf = p => (p.you ? X.fieldPos(c) : X.roleOf(p, 'bat'))
  return (
    <div className="ag-card crl ag-pop">
      <div className="ag-card-head"><span className="ag-eyebrow">{c.fit?.name?.toUpperCase()} · THE LINEUP</span><span className={`crl-role${u.starter ? ' is-on' : ''}`}>{u.label}</span></div>
      <div className="crl-bench">
        <span className="ag-eyebrow">THE BATTING ORDER</span>
        {nine.map(({ p, spot }) => <Row key={p.name} p={p} tag={`${spot} · ${posOf(p)}`} />)}
        {bench.length > 0 && <><span className="ag-eyebrow">THE BENCH</span>{bench.map((p, i) => <Row key={p.name + i} p={p} tag={posOf(p)} />)}</>}
      </div>
      {!u.starter && dc.ahead.length > 0 && <p className="cr-note">On the bench behind {dc.ahead[dc.ahead.length - 1].name}. Hit when he gets his at-bats and the everyday job is {c.name}&apos;s.</p>}
      <p className="cr-note">{S.fitNote(c.fit ?? {}, c.pos)}</p>
    </div>
  )
}

// ── A run of games ───────────────────────────────────────────────────────────
export function BaseballChunk({ c, e }) {
  const games = e.games ?? []
  const w = games.filter(g => g.won).length
  const on = games.filter(g => !g.sat && g.app)
  const sum = k => on.reduce((s, g) => s + (g[k] ?? 0), 0)
  const X = bx()
  let line
  if (!on.length) line = <small>{games.some(g => g.sat) ? (c.active?.out0 >= e.k1 && c.minors && !c.minors.done ? `In the minors at ${X.levelName(c.minors.level)}.` : 'On the injured list.') : c.pos === 'pit' ? 'Not used in these games.' : 'On the bench.'}</small>
  else if (c.pos === 'pit') {
    const outs = sum('outs'), er = sum('er'), starts = sum('gs')
    const best = [...on].sort((a, b) => ((b.k ?? 0) - (b.er ?? 0) * 3 + (b.outs ?? 0) * 0.3) - ((a.k ?? 0) - (a.er ?? 0) * 3 + (a.outs ?? 0) * 0.3))[0]
    line = <><b>{starts ? `${starts} ${starts === 1 ? 'start' : 'starts'}` : `${on.length} ${on.length === 1 ? 'game' : 'games'}`}</b> · {sum('w')}-{sum('l')}{sum('sv') ? ` · ${sum('sv')} SV` : ''} · <b>{ip(outs)}</b> IP · {er} ER · {sum('k')} K{outs ? ` · ${f2(er * 27 / outs)} ERA` : ''}{best && <small>Best: {X.ipText(best.outs)} IP, {best.er} ER, {best.k} K vs the {sportOf(c).teamOf(best.opponent)?.nick ?? best.opponent}</small>}</>
  } else {
    const ab = sum('ab'), h = sum('h'), hr = sum('hr'), rbi = sum('rbi')
    const best = [...on].sort((a, b) => ((b.hr ?? 0) * 4 + (b.h ?? 0) + (b.rbi ?? 0)) - ((a.hr ?? 0) * 4 + (a.h ?? 0) + (a.rbi ?? 0)))[0]
    line = <><b>{h}-for-{ab}</b>{hr ? <> · <b>{hr}</b> HR</> : null} · {rbi} RBI{sum('sb') ? ` · ${sum('sb')} SB` : ''}{ab ? ` · ${r3(h / ab)}` : ''}{best && (best.hr || best.h >= 3) ? <small>Best: {best.h}-for-{best.ab}{best.hr ? `, ${best.hr} HR` : ''}, {best.rbi} RBI vs the {sportOf(c).teamOf(best.opponent)?.nick ?? best.opponent}</small> : null}</>
  }
  return (
    <div className="ag-card cr-chunk">
      <div className="cr-chunk-head"><span className="ag-eyebrow">{e.k0 === e.k1 ? `GAME ${e.k0}` : `GAMES ${e.k0}–${e.k1}`}</span><b>{w}–{games.length - w}</b></div>
      <div className="cr-chunk-strip">{games.map(g => <span key={g.g} className={`${g.won ? 'is-w' : 'is-l'}${g.sat || !g.app ? ' is-sat' : ''}`} title={`${g.won ? 'W' : 'L'} ${g.mySc}–${g.oppSc} ${g.home ? 'vs' : 'at'} ${g.opponent}`}>{g.won ? 'W' : 'L'}</span>)}</div>
      <p className="cr-chunk-line">{line}</p>
      {(e.hits?.some(h => h.big) || e.headline?.length > 0) && (
        <div className="cr-feed-lines">{e.hits?.filter(h => h.big).map(h => <span key={h.id} className="cr-ms"><IconStar size={12} /> {h.label}</span>)}{e.headline?.slice(-1).map((t, k) => <span key={k} className="cr-hl">{t}</span>)}</div>
      )}
    </div>
  )
}

// ── October: the series, one at a time ───────────────────────────────────────
// the moment's game in a series: "Game 5, 5-4 walk-off win" (the score the moment played into)
export const momentGameText = (m, short = false) => (!m?.n ? '' : short ? `G${m.n} ${m.my}–${m.opp}` : `Game ${m.n}, ${m.won ? `${m.my}-${m.opp}` : `${m.opp}-${m.my}`} ${m.walkoff ? 'walk-off win' : m.won ? 'win' : 'loss'}`)
export function BaseballPostseason({ c, setCareer, onBook, step, setStep, game, sit, odds, noGames }) {
  const S = sportOf(c), X = bx()
  const po = c.active.po
  const rd = po.rounds[po.idx]
  const last = po.line[po.line.length - 1]
  const pct = x => Math.min(99, Math.max(1, Math.round(x * 100)))
  const need = rd ? (rd.bestOf + 1) / 2 : 4
  const allow = gamesMode(c) === 'simple' ? g => !!SIMPLE_GAMES[g] : null
  if (po.stage === 'done' || step === 'result') {
    const x = last
    const nextName = x ? po.rounds[po.rounds.findIndex(r => r.name === x.name) + 1]?.short : null
    return (
      <div className="cr-po">
        {x && (
          <div className={`ag-card cr-po-result ag-pop${x.won ? ' is-w' : ' is-l'}`}>
            <span className="ag-eyebrow">{x.sat ? 'FROM THE DUGOUT · ' : ''}{(x.title ?? x.name).toUpperCase()} · BEST OF {x.bestOf}</span>
            <div className="cr-po-board">
              {[[c.team, x.mySc, x.won], [x.opp, x.oppSc, !x.won]].map(([t, sc, up]) => (
                <div key={t} className={`cr-po-side${up ? ' is-up' : ''}`} style={{ '--tc': S.teamOf(t)?.color ?? '#26302c' }}>
                  <img src={S.logo(t)} alt="" />
                  <small>{t}</small>
                  <b>{sc}</b>
                </div>
              ))}
            </div>
            {x.moment?.n && <span className="ag-eyebrow">{`Game ${x.moment.n}: ${c.team} ${x.moment.my}, ${x.opp} ${x.moment.opp}${x.moment.walkoff ? '. A walk-off' : ''}${x.moment.note ? `. ${x.moment.note}` : ''}`}</span>}
            <b>{x.won ? (x.name === 'World Series' ? 'World Series champions.' : `Through to the ${nextName ?? 'next round'}.`) : x.name === 'World Series' ? 'Beaten in the World Series.' : `Season over in the ${x.short}.`}</b>
            <small>{x.sat ? 'He watched it from the dugout, injured.' : c.pos === 'pit' ? `${X.ipText(x.outs ?? 0)} IP, ${x.er ?? 0} ER, ${x.k ?? 0} K${x.sv ? `, ${x.sv} ${x.sv === 1 ? 'save' : 'saves'}` : ''}` : `${x.h ?? 0}-for-${x.ab ?? 0}, ${x.hr ?? 0} HR, ${x.rbi ?? 0} RBI`}{!x.sat && <> · {x.auto ? (x.won ? 'never in doubt' : 'never close') : x.decider ? (x.won ? 'it went the distance' : 'it went the distance, and it went the other way') : x.hit ? 'he came through when it mattered' : 'the big moment got away from him'}</>}</small>
          </div>
        )}
        {po.stage === 'done'
          ? <button className="ag-btn ag-btn--gold tk-intro-go" onClick={onBook}>WRAP THE SEASON <IconArrow size={16} /></button>
          : <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { setStep('card'); sfx('tap') }}>THE {nextName ?? 'NEXT ROUND'} <IconArrow size={16} /></button>}
      </div>
    )
  }
  // (a last play decides one game of the series, the need-th: the score going in, and the series after it)
  const ss = odds?.state
  const stakes = !odds ? '' : ss
    ? `${ss.a === ss.b ? `Tied ${ss.a}-${ss.b}` : ss.a > ss.b ? `Up ${ss.a}-${ss.b}` : `Down ${ss.a}-${ss.b}`} in the series. Land it and ${ss.a + 1 === need ? 'they take the series' : `it’s ${ss.a + 1}-${ss.b}: about ${pct(ss.win)}% to take it`}. Miss it: ${ss.b + 1 === need && odds.game <= 0.03 ? 'they’re out' : `about ${pct(ss.miss)}%`}.`
    : `A big moment in the series, not the last of it. Land it: about ${pct(odds.hit)}% to take the series. Miss it: about ${pct(odds.miss)}%.`
  if (step === 'game') return (
    <div className="cr-po">
      <div className="cr-po-head"><span className="ag-eyebrow">{rd.short.toUpperCase()} · VS {rd.oppName.toUpperCase()}</span><small className="cr-po-stakes">{sit.line}{sit.tail ? ` ${sit.tail}` : ''} {stakes}</small></div>
      <CareerGame home={rd.home === false ? 'opp' : 'team'} retry c={c} setCareer={setCareer} team={c.fit} pos={combinePos(c)} opp={S.teamOf(rd.opp)} cast={gameCast(c, rd.opp)} situation={sit} key={`${po.idx}-${game}`} game={game} build={c.build} seed={`${c.seed}-${c.year}-${po.idx}`} lock={`${c.seed}-${c.year}-${po.idx}`} onDone={res => { setCareer(playoffRound(c, res.score, game, res.hit, res.raw ?? null)); setStep('result') }} />
    </div>
  )
  return (
    <div className="cr-po">
      <div className="ag-card cr-po-card ag-pop">
        <span className="ag-eyebrow">{(rd.title ?? rd.name).toUpperCase()} · BEST OF {rd.bestOf}</span>
        <div className="cr-po-match"><img src={S.logo(c.team)} alt="" /><b>{c.team}</b><i>vs</i><b>{rd.opp}</b><img src={S.logo(rd.opp)} alt="" /></div>
        <small>{rd.oppName} ({rd.oppWins} wins) · {rd.home ? 'Home-field advantage' : 'They have home field'} · {pct(cardOdds(c, po, allow, noGames))}% to win the series</small>
        <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { sfx('whistle'); if (noGames) { setCareer(playoffRound(c, null)); setStep('result') } else setStep('game') }}>PLAY THE SERIES <IconArrow size={16} /></button>
      </div>
      {po.line.length > 0 && <div className="cr-goals">{po.line.map(x => <span key={x.name} className={`cr-goal${x.won ? ' is-met' : ' is-miss'}`}>{x.short}: {x.won ? 'W' : 'L'} {x.mySc}–{x.oppSc}{x.moment?.n ? ` · ${momentGameText(x.moment, true)}` : ''}</span>)}</div>}
    </div>
  )
}
void gradeOf; void IconMedal; void IconCrown
