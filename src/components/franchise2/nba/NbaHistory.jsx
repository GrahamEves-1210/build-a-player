import { useContext, useMemo, useState } from 'react'
import { TEAM, seasonText, FINISH_TEXT, AWARD_FULL, nick, manOf, SHORTS, FIRST_YEAR } from '../../../lib/franchise2/nba'
import { RECORD_ROWS, realRecord, recordValue, hallOfFamer, hallClass } from '../../../lib/franchise2/nba/awards'
import { careerTotals } from '../../../lib/franchise2/nba/realCareers'
import { sfx } from '../../../lib/juice'
import { Banner, Chyron, BigNum, Fact, Fold, KLogo, fkVars, splitName } from '../kit'
import { AwardTeams, statLine, cfMvps, ManOpen, ManSheetHost, tapMan } from './NbaOffseason'
import './nbaoff.css'
import '../fd2.css'

// HISTORY: the wall (every season: record, how it ended; the league's award winners by year), the records book (the
// league's single-game, season and career marks next to the NBA's own, and the GM's team's), the Hall of Fame (the
// retired men who go in, the numbers the team has hung), and the save itself. The records and the Hall are laid out
// with football History's pieces (fd2.css: the plaques, the jerseys). A tap on a man opens his page, read-only
// (ManSheetHost without act).
const AW_KEYS = ['MVP', 'FMVP', 'DPOY', 'ROY', '6MOY', 'MIP', 'CLUTCH']
const AW_LABEL = { ...AWARD_FULL, ECF: 'Eastern Conference Finals MVP', WCF: 'Western Conference Finals MVP' }
const VIEWS = [['wall', 'The wall'], ['rec', 'Records'], ['hall', 'Hall of Fame']]
export default function NbaHistory({ F, owner, onSlots, onDelete }) {
  return <ManSheetHost F={F} owner={owner}><History F={F} onSlots={onSlots} onDelete={onDelete} /></ManSheetHost>
}
function History({ F, onSlots, onDelete }) {
  const [sure, setSure] = useState(false)
  const [v, setV] = useState('wall')
  const H = F.hist ?? []
  const best = H.slice().sort((a, b) => b.w - a.w)[0]
  return (
    <div className="nb-hist">
      <div className="fsu-card-nums nb-hist-nums">
        <BigNum v={F.rings ?? 0} label={F.rings === 1 ? 'TITLE' : 'TITLES'} size={52} tone={F.rings ? 'gold' : undefined} />
        <Fact v={H.length} label={H.length === 1 ? 'SEASON' : 'SEASONS'} size={36} />
        <Fact v={best ? `${best.w}-${best.l}` : '-'} label="BEST RECORD" size={36} />
      </div>
      <div className="fh-seg nb-seg" role="tablist" aria-label="History" style={{ '--n': VIEWS.length }}>
        {VIEWS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={v === k} className={v === k ? 'is-on' : ''} onClick={() => { setV(k); sfx('tap') }}>{l}</button>)}
      </div>
      {v === 'wall' && (
        <>
          <Chyron team={F.team} title="The wall" sub={`${F.owner.toUpperCase()} · GENERAL MANAGER`} />
          {!H.length && <p className="fh-next-note">The first season goes up here when it ends.</p>}
          <div className="nb-wall-banners">
            {H.slice().reverse().map((h, k) => <Banner key={h.y} year={seasonText(h.y)} title={(h.finish === 'champ' ? 'NBA CHAMPIONS' : FINISH_TEXT[h.finish] ?? '').toUpperCase()} rec={`${h.w}-${h.l}${h.seed ? ` · NO. ${h.seed} SEED` : ''}`} team={h.s} gold={h.finish === 'champ'} delay={k * 50} />)}
          </div>
          {H.length > 0 && <Chyron tone="ink" size="s" title="League honors" sub="EVERY SEASON'S AWARDS" />}
          {H.slice().reverse().map((h, k) => <Honors key={h.y} F={F} h={h} open={k === 0} />)}
        </>
      )}
      {v === 'rec' && <Records F={F} />}
      {v === 'hall' && <Hall F={F} />}
      <div className="nb-save">
        <button type="button" className="fh-textbtn" onClick={() => { sfx('tap'); onSlots() }}>Save slots</button>
        {!sure ? <button type="button" className="fh-textbtn" onClick={() => setSure(true)}>Delete this save</button>
          : <span className="nb-sure">Delete the {TEAM[F.team].nick} save for good? <button type="button" className="fh-textbtn" onClick={() => setSure(false)}>Keep</button><button type="button" className="fh-textbtn is-danger" onClick={onDelete}>Delete</button></span>}
      </div>
    </div>
  )
}

// ── The records book ─────────────────────────────────────────────────────────
// The league's marks (awards.js updateRecords keeps them in F.rec as the seasons end) next to the NBA's own
// (REAL_RECORDS): a plaque a mark, the man and the season on it, the NBA record under it; a mark past the NBA's is
// the record and says whose it passed. Careers count a real man's seasons before the save, and are read off the
// rosters as they stand, so the book is right in the middle of a season too. Then the GM's team's own book.
const BOOKS = [['game', 'Single game'], ['season', 'Season'], ['career', 'Career']]
const when = (book, y) => (y == null ? '' : book === 'career' ? '' : seasonText(y))
function liveCareers(F) {
  const out = { ...(F.rec?.career ?? {}) }
  const men = [...SHORTS.flatMap(s => F.teams[s].r), ...(F.fa ?? [])]
  for (const p of men) {
    const cur = F.phase !== 'off' ? F.ss?.[p.i] : null
    const t = careerTotals(p, cur && !(p.car ?? []).some(c => c.y === F.year) ? cur : null)
    if (!t.gp) continue
    for (const [k] of RECORD_ROWS.career) if (t[k] > (out[k]?.v ?? 0)) out[k] = { v: t[k], i: p.i, n: p.n }
  }
  return out
}
function Records({ F }) {
  const [book, setBook] = useState('season')
  const page = useContext(ManOpen)
  const careers = useMemo(() => liveCareers(F), [F])
  const R = F.rec ?? {}
  const lg = book === 'career' ? careers : R[book] ?? {}
  const fr = R.fr?.s === F.team ? R.fr[book] ?? {} : {}
  const from = seasonText(R.from ?? FIRST_YEAR)
  const any = RECORD_ROWS[book].some(([k]) => lg[k])
  const H = F.hist ?? [], top = H.slice().sort((a, b) => b.w - a.w)[0]
  return (
    <>
      <div className="nb-by" role="tablist" aria-label="The records book">{BOOKS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={book === k} className={book === k ? 'is-on' : ''} onClick={() => { setBook(k); sfx('tap') }}>{l}</button>)}</div>
      <Chyron tone="ink" size="s" title="League records" right={book === 'career' ? 'ALL-TIME' : `SINCE ${from}`} />
      {!any && book !== 'career' && <p className="fh-next-note">This season&apos;s marks go in the book when it ends. The NBA&apos;s records are the ones to beat.</p>}
      <div className="fd-plaques nb-recs">
        {RECORD_ROWS[book].map(([k, label]) => {
          const x = lg[k], real = realRecord(book, k)
          const past = !!(x && real && x.v > real[0])
          return (
            <div key={k} className={`fd-plaque nb-rec${past ? ' is-nba' : ''}${x && page ? ' is-tap' : ''}`} {...(x ? tapMan(page, F, x.i) : {})}>
              <small>{label}</small>
              <b>{x ? recordValue(k, x.v) : '-'}</b>
              <em><span>{x ? x.n : 'No mark yet'}</span>{x && when(book, x.y) && <i>{when(book, x.y)}</i>}</em>
              {real && <u>{past ? `NBA record · past ${real[1]}'s ${recordValue(k, real[0])}` : `NBA record ${recordValue(k, real[0])} · ${real[1]}, ${real[2]}`}</u>}
            </div>
          )
        })}
      </div>
      {book === 'career' && <p className="fh-next-note">A career counts every NBA season, the ones before {from} too.</p>}
      <Chyron team={F.team} size="s" title={`${TEAM[F.team].nick} records`} right={`SINCE ${seasonText(H[0]?.y ?? F.year)}`} />
      {!RECORD_ROWS[book].some(([k]) => fr[k]) ? <div className="fd-none">{H.length ? 'NO MARKS IN THIS BOOK YET' : 'THE FIRST SEASON GOES IN WHEN IT ENDS'}</div> : (
        <div className="fd-plaques nb-recs">
          {book === 'season' && top && <div className="fd-plaque nb-rec"><small>Wins</small><b>{top.w}</b><em><span>{`${top.w}-${top.l}`}</span><i>{seasonText(top.y)}</i></em></div>}
          {RECORD_ROWS[book].filter(([k]) => fr[k]).map(([k, label]) => {
            const x = fr[k]
            return (
              <div key={k} className={`fd-plaque nb-rec${page ? ' is-tap' : ''}`} {...tapMan(page, F, x.i)}>
                <small>{label}</small><b>{recordValue(k, x.v)}</b><em><span>{x.n}</span>{when(book, x.y) && <i>{when(book, x.y)}</i>}</em>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── The Hall of Fame ─────────────────────────────────────────────────────────
// The retired men who go in (awards.js hallOfFamer), by class: a man is eligible two full seasons after his last,
// the Hall's own wait, so the class of a man who last played in 2026-27 is 2030. Until then he is listed as
// eligible that year. And the numbers the GM's team has hung: his builds', and a Hall of Famer's who played for him.
function Hall({ F }) {
  const page = useContext(ManOpen)
  const L = useMemo(() => (F.retired ?? []).filter(r => hallOfFamer(r)).sort((a, b) => (hallClass(a) ?? 9999) - (hallClass(b) ?? 9999) || (b.t?.[1] ?? 0) - (a.t?.[1] ?? 0)), [F.retired])
  const inNow = r => (hallClass(r) ?? 9999) <= F.year
  const jerseys = (F.retired ?? []).filter(r => r.num != null && (r.b != null || (r.gm && hallOfFamer(r))))
  const whole = r => r.rc || !((r.yrs ?? 0) > (r.y ?? FIRST_YEAR) - FIRST_YEAR + 1)
  const line = r => { const [gp, pts, reb, ast] = r.t ?? []; const f = x => (x / gp).toFixed(1); return [`${r.yrs} ${r.yrs === 1 ? 'SEASON' : 'SEASONS'}`, gp && whole(r) ? `${f(pts)} PTS · ${f(reb)} REB · ${f(ast)} AST` : null].filter(Boolean).join(' · ') }
  const row = r => (
    <li key={r.i} className={r.gm || r.b != null ? 'is-me' : ''} style={r.s && TEAM[r.s] ? fkVars(r.s) : undefined} {...tapMan(page, F, r.i)}>
      {r.s && TEAM[r.s] ? <KLogo s={r.s} size={24} /> : <i className="nbo-nologo" />}
      <span><small>{inNow(r) ? `Class of ${hallClass(r)}` : `Eligible ${hallClass(r) ?? ''}`}</small><b>{r.n}</b><em>{line(r)}</em></span>
    </li>
  )
  const inducted = L.filter(inNow), waiting = L.filter(r => !inNow(r))
  return (
    <>
      <Chyron tone="gold" size="s" title="Hall of Fame" right={inducted.length || null} />
      {!inducted.length && <div className="fd-none">NO ONE FROM THIS LEAGUE HAS GONE IN YET</div>}
      {inducted.length > 0 && <ul className="nbo-hon-list nb-hall">{inducted.map(row)}</ul>}
      {waiting.length > 0 && (
        <>
          <Chyron tone="ink" size="s" title="On the way in" right={waiting.length} />
          <ul className="nbo-hon-list nb-hall is-wait">{waiting.map(row)}</ul>
        </>
      )}
      <Chyron team={F.team} size="s" title="Retired numbers" right={jerseys.length || null} />
      {jerseys.length ? (
        <div className="fd-jerseys">
          {jerseys.map(r => <span key={r.i} className="fd-jersey" style={fkVars(F.team)} {...tapMan(page, F, r.i)}><b>{r.num}</b><small>{splitName(r.n).last.toUpperCase()}</small><em>{r.yrs} {r.yrs === 1 ? 'SEASON' : 'SEASONS'}</em></span>)}
        </div>
      ) : <div className="fd-none">NO NUMBERS RETIRED YET</div>}
    </>
  )
}
// one season's honors: the trophies (each winner's team and line), then the All-NBA, All-Defensive and All-Rookie teams
function Honors({ F, h, open }) {
  const page = useContext(ManOpen)
  const A = h.aw ?? {}
  const list = [...AW_KEYS.filter(k => A[k]).map(k => [k, A[k]]), ...cfMvps(F, h)]
  return (
    <Fold className="nbo-hon" open={open} title={seasonText(h.y)} right={h.champ ? `${nick(h.champ)} champions` : null}>
      <ul className="nbo-hon-list">
        {list.map(([k, w]) => {
          const line = statLine(F, w.i, h.y, k, w)
          const p = manOf(F, w.i)
          return (
            <li key={k} className={w.s === F.team ? 'is-me' : ''} style={w.s && TEAM[w.s] ? fkVars(w.s) : undefined} {...tapMan(page, F, w.i)}>
              {w.s && TEAM[w.s] ? <KLogo s={w.s} size={24} /> : <i className="nbo-nologo" />}
              <span><small>{AW_LABEL[k] ?? k}</small><b>{w.n}</b><em>{[p?.p ?? w.p, TEAM[w.s]?.short, line].filter(Boolean).join(' · ')}</em></span>
            </li>
          )
        })}
        {h.coy && (
          <li className={h.coy.s === F.team ? 'is-me' : ''} style={TEAM[h.coy.s] ? fkVars(h.coy.s) : undefined}>
            <KLogo s={h.coy.s} size={24} />
            <span><small>Coach of the Year</small><b>{h.coy.n}</b><em>{`HC · ${h.coy.s} · ${h.coy.rec}`}</em></span>
          </li>
        )}
      </ul>
      <AwardTeams F={F} y={h.y} title="All-NBA" teams={A.ALL} names={['First team', 'Second team', 'Third team']} />
      <AwardTeams F={F} y={h.y} title="All-Defensive" teams={A.ALLDEF} names={['First team', 'Second team']} k="DEF" />
      <AwardTeams F={F} y={h.y} title="All-Rookie" teams={A.ROOKIE} names={['First team', 'Second team']} />
    </Fold>
  )
}
