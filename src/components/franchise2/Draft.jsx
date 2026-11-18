import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  TEAM, POS, POS_LABEL, GRADES, gradeOf, newSeason,
  scoutsLeft, syncScouts, PER_WEEK, film, filmDone, interview, visitsLeft, proDay, springOn, canScout, runCombine, slateOf, attend, autoScout,
  viewOf, rangeText, knownShare, reportOf, consensus, rankMap, projText, stockMoves, mockDraft, mockVersion, needsOf,
  seasonLine, gameLine, lineText, combineOf, star, moveOnBoard, spotLabel, pickSpot, heightText, CLASS_LABEL, KIND_LABEL, CHAR_TEXT,
  startNight, cpuPicks, userPick, autoPick, simRest, pickTeam, draftDone, myPicks, roundOf, boardRank, markSeen,
  tradeUpOffers, tradeDownOffers, acceptTrade, draftReview, closeDraft, TAG_TEXT, lightNewSeason,
} from '../../lib/franchise2'
import { groupOf, jersey } from '../../lib/franchise2/roster'
import { faceUrl, buildFaceUrl, facePos } from '../../lib/franchise2/faces'
import { realOf } from '../../lib/franchise2/league'
import { TYPES_OF } from '../../lib/squadSeason'
import { nflHeadshot } from '../../utils/simulation'
import { CFB_TEAM_BY_SHORT } from '../../data/cfb-teams'
import { ATTR } from '../../data/qbs'
import { RB_ATTR } from '../../data/rbs'
import { WR_ATTR } from '../../data/wrs'
import { TE_ATTR } from '../../data/tes'
import { OL_ATTR } from '../../data/ols'
import { DL_ATTR } from '../../data/dls'
import { LB_ATTR } from '../../data/lbs'
import { DB_ATTR } from '../../data/dbs'
import { K_ATTR } from '../../data/ks'
import { sfx, haptic } from '../../lib/juice'
import { Chyron, KLogo, BigNum, Stamp, Go, Tag, Flip, fkVars, reduced, splitName, ActionBar } from './kit'
import './draft.css'
import { teamKit, schoolKit } from '../../lib/franchise2/kits'

// SCOUTING AND THE DRAFT (engine: lib/franchise2/draft.js).
//   DraftBoard  the scouting room, a sheet over the hub: this week's college games, the class, our board, the mock
//   DraftDay    the offseason's last stop: draft week (the final board), then draft night (the clock, the league's
//               picks, trades, our picks turned over), then our class and how good the scouting was

const ATTRS = { qb: ATTR, rb: RB_ATTR, wr: WR_ATTR, te: TE_ATTR, ol: OL_ATTR, dl: DL_ATTR, lb: LB_ATTR, db: DB_ATTR, k: K_ATTR }
// (a rating's whole name, never cut: a long one wraps, after a slash where it has one)
const attrName = (pos, t) => (ATTRS[pos]?.[t]?.label ?? t).toUpperCase().replace('/', '/' + String.fromCharCode(0x200b))
const school = col => CFB_TEAM_BY_SHORT[col] ?? null
const schoolName = col => (school(col)?.school ?? 'SANDBOX').toUpperCase()
// a college's colours as slab colours (the same rules as the kit's team slabs)
const lum = hex => { const n = parseInt(String(hex || '#333333').slice(1, 7), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const CV = new Map()
export function colVars(col) {
  if (CV.has(col)) return CV.get(col)
  const t = school(col)
  let a = t?.color ?? '#2b3039', b = t?.color2 ?? '#ffffff'
  if (lum(a) < 0.012) a = '#262a31'
  if (lum(b) < 0.02 || Math.abs(lum(b) - lum(a)) < 0.03) b = '#ffffff'
  const v = { '--tc': a, '--tc2': b, '--tct': lum(a) > 0.3 ? '#0b0c0e' : '#ffffff' }
  CV.set(col, v)
  return v
}
const colColor = col => school(col)?.color ?? '#2b3039'
const colKit = col => schoolKit(school(col)) ?? colColor(col)
const SUIT = '#1c1f25'
// a face: a Sandbox build's own (his best trait's photo), anyone else's drawn (faces.js); small: a list row's, the
// lighter drawing
const faceFor = (F, x, color, small = false) => (x.b != null && F?.builds?.[x.b] ? buildFaceUrl(F.builds[x.b], color, small ? 'sm' : 'full') : faceUrl(x.fk ?? x.n, facePos(x), color, null, small))
const sandboxOn = () => { try { return localStorage.getItem('bap_custom_mode') === '1' } catch { return false } }
const CollegeLogo = ({ col, size = 22 }) => (school(col) ? <img className="dr-col" src={school(col).dark ?? school(col).logo} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" draggable={false} onError={e => { e.currentTarget.style.visibility = 'hidden' }} /> : null)
const tap = () => sfx('tap')
// a man's CONSENSUS NO.: his place on the media's board; on draft night the board as it stood when the draft began
// (draft.js boardRank), never his place among the men still left
const nightOf = F => F.dr?.ph === 'night'
const ranksOf = F => (nightOf(F) ? boardRank(F) : rankMap(F))
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`

// ── One prospect, the broadcast way ──────────────────────────────────────────
// His face against his school's colours (his college number faint behind him), his name on a bar, our grade in a box.
function Prospect({ F, x, rank, onOpen, line, right, delay = 0, starOk = true, act }) {
  const v = viewOf(F, x)
  const { first, last } = splitName(x.n)
  const on = F.board.includes(x.i)
  const sure = knownShare(x) >= 0.6
  return (
    <div className="dr-p" style={{ '--d': `${delay}ms` }}>
      <button type="button" className="dr-p-main" onClick={() => { onOpen?.(x.i); tap() }}>
        {rank != null && <span className="dr-p-rank">{rank}</span>}
        <span className="dr-p-slab" style={colVars(x.col)} aria-hidden="true">
          <span className="dr-p-num">{x.nu}</span>
          <img className="dr-p-face" src={faceFor(F, x, colKit(x.col), true)} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
        <span className="dr-p-bar">
          <span className="dr-p-name"><small>{first}</small><b>{last}</b></span>
          <span className="dr-p-meta"><em>{spotLabel(x)}</em><CollegeLogo col={x.col} size={15} /><span>{schoolName(x.col)}</span></span>
          {line && <span className="dr-p-line">{line}</span>}
        </span>
        {right ?? (
          <span className={`dr-p-grade${sure ? ' is-sure' : ''}`}>
            <b>{gradeOf(v.my)}</b>
            <Known x={x} />
          </span>
        )}
      </button>
      {starOk && act && <button type="button" className={`dr-p-star${on ? ' is-on' : ''}`} aria-label={on ? 'Off the board' : 'On the board'} onClick={() => { act(X => star(X, x.i)); sfx('slot') }}>{on ? '★' : '☆'}</button>}
    </div>
  )
}
// how much of him our people have seen: five segments
const Known = ({ x }) => { const k = knownShare(x); return <span className="dr-known" aria-label={`${Math.round(k * 100)}% scouted`}>{[0, 1, 2, 3, 4].map(i => <i key={i} className={k >= (i + 1) / 5 - 0.02 ? 'is-on' : k > i / 5 + 0.02 ? 'is-half' : ''} />)}</span> }

// ── The prospect's card (a sheet) ────────────────────────────────────────────
function ProspectCard({ F, act, id, onClose, onDraft, draftLabel }) {
  const x = F.dc.find(p => p.i === id)
  const [fresh, setFresh] = useState('')
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  if (!x) return null
  const v = viewOf(F, x), r = reportOf(F, x, v)
  const rank = ranksOf(F).get(x.i)
  const c = F.sc?.cmb ? combineOf(x) : null
  const st = seasonLine(F, x)
  const { first, last } = splitName(x.n)
  const on = F.board.includes(x.i)
  const groups = ['p', 's', 'm'].map(k => [k, v.traits.filter(t => t.kind === k)])
  const doScout = fn => { const was = x.k; const ok = act(fn); if (ok) { setFresh(was); sfx('flip'); haptic('light'); setTimeout(() => sfx('gradepop', 7), reduced() ? 0 : 260) } else sfx('deny') }
  const comp = r.comp && realOf(x.p, r.comp.name)
  return createPortal(
    <div className="dr-sheet fk" role="dialog" aria-label={x.n} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dr-card">
        <div className="dr-hero" style={colVars(x.col)}>
          <span className="dr-hero-num" aria-hidden="true">{x.nu}</span>
          <img className="dr-hero-face" src={faceFor(F, x, colKit(x.col))} alt="" draggable={false} />
          <span className="dr-hero-logo"><CollegeLogo col={x.col} size={46} /></span>
          <button type="button" className="dr-x" onClick={() => { onClose(); tap() }} aria-label="Close">✕</button>
        </div>
        <div className="dr-hero-bar">
          <span className="dr-hero-name"><small>{first}</small><b>{last}</b></span>
          <span className="dr-hero-meta">{spotLabel(x)} · {schoolName(x.col)} · {x.b != null ? 'SANDBOX' : CLASS_LABEL[x.cl]}</span>
          <span className="dr-hero-body"><b>{heightText(x.ht)}</b><small>HT</small><b>{x.wt}</b><small>LB</small><b>{x.ag}</b><small>AGE</small></span>
        </div>
        <div className="dr-card-body">
          <div className="dr-grades">
            <span className="dr-gr is-ours"><small>OUR GRADE</small><b>{gradeOf(v.my)}</b><em>{gradeOf(v.lo) === gradeOf(v.hi) ? 'CONFIRMED' : rangeText(v).replace(' – ', ' TO ')}</em></span>
            <span className="dr-gr"><small>CONSENSUS</small><b>{rank ? `NO. ${rank}` : '—'}</b><em>{rank ? projText(rank) : ''}</em></span>
            <span className="dr-gr"><small>SCOUTED</small><b>{Math.round(knownShare(x) * 100)}%</b><Known x={x} /></span>
          </div>
          {(gradeOf(v.my) === 'S' || gradeOf(v.hi) === 'S') && <p className="dr-key">S is the top grade, above A+: a 97+ player, the best in the league at his spot.</p>}
          {groups.map(([k, list]) => (
            <div key={k} className="dr-traits">
              <span className="dr-traits-h">{KIND_LABEL[k]}{k === 'm' && <em>{v.kc ? ` · ${CHAR_TEXT[x.ch]}` : ' · CHARACTER UNKNOWN'}</em>}</span>
              <div className="dr-traits-row">
                {list.map(t => {
                  const j = TYPES_OF[x.p].indexOf(t.t), was = fresh ? +fresh[j] : t.k
                  return (
                    <span key={`${t.t}${t.k}`} className={`dr-tr is-k${t.k}${fresh && was < t.k ? ' is-new' : ''}`} style={{ '--d': `${j * 40}ms` }}>
                      <small>{attrName(x.p, t.t)}</small>
                      <b>{t.k === 2 ? GRADES[t.v] : t.k === 1 ? `${GRADES[t.lo]}–${GRADES[t.hi]}` : '?'}</b>
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
          {(r.lines.length > 0 || r.char || r.bottom) && (
            <div className="dr-report">
              <span className="dr-traits-h">SCOUTING REPORT</span>
              {r.lines.map((l, i) => <p key={i} className={l.good ? 'is-good' : 'is-bad'}>{l.text}</p>)}
              {r.char && <p className={x.ch === 0 ? 'is-bad' : 'is-good'}>{r.char}</p>}
              {r.bottom && <p className="dr-bottom"><b>BOTTOM LINE</b>{r.bottom}</p>}
              {r.comp && (
                <div className="dr-comp" style={fkVars(r.comp.team)}>
                  <span className="dr-comp-slab">{comp?.h && <img src={nflHeadshot(comp.h)} alt="" loading="lazy" draggable={false} />}</span>
                  <span className="dr-comp-txt"><small>PRO COMPARISON</small><b>{r.comp.name.toUpperCase()}</b></span>
                  <KLogo s={r.comp.team} size={28} />
                </div>
              )}
            </div>
          )}
          {!r.lines.length && !r.char && x.b == null && <p className="dr-empty">NO REPORT YET</p>}
          {st && (
            <div className="dr-stat">
              <span className="dr-traits-h">{F.year} · {schoolName(x.col)} · {st.g} GAMES</span>
              <b>{lineText(x.p, st)}</b>
            </div>
          )}
          {c && (
            <div className="dr-combine">
              <span className="dr-traits-h">COMBINE{c.dnp ? ' · DID NOT WORK OUT' : ''}</span>
              {!c.dnp && c.kick && <div className="dr-facts">
                <CFact v={c.lng} label="LONG FG" />
                <CFact v={`${c.made}/10`} label="FG" />
              </div>}
              {!c.dnp && !c.kick && <div className="dr-facts">
                <CFact v={c.f40?.toFixed(2)} label="40" />
                <CFact v={c.vert != null ? `${c.vert}"` : null} label="VERT" />
                <CFact v={c.bench} label="BENCH" />
                <CFact v={c.cone?.toFixed(2)} label="3-CONE" />
              </div>}
            </div>
          )}
        </div>
        <div className="dr-card-acts">
          {onDraft ? <Go onClick={() => onDraft(x)}>{draftLabel ?? 'DRAFT'}</Go> : (
            <>
              {canScout(F) && x.b == null && !filmDone(x) && <Go ghost disabled={scoutsLeft(F) < 1} onClick={() => doScout(X => film(X, x.i))} sub="1 DAY">{x.sv & 1 ? 'MORE FILM' : 'WATCH FILM'}</Go>}
              {springOn(F) && x.b == null && !x.kc && <Go ghost disabled={visitsLeft(F) < 1} onClick={() => doScout(X => interview(X, x.i))} sub={`${visitsLeft(F)} ${visitsLeft(F) === 1 ? 'VISIT' : 'VISITS'} LEFT`}>TOP-30 VISIT</Go>}
            </>
          )}
          <button type="button" className={`dr-board-btn${on ? ' is-on' : ''}`} onClick={() => { act(X => star(X, x.i)); sfx('slot') }}>{on ? '★ ON OUR BOARD' : '☆ ADD TO OUR BOARD'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
const CFact = ({ v, label }) => <span className={`dr-cf${v == null ? ' is-dnp' : ''}`}><b>{v ?? '—'}</b><small>{label}</small></span>

// ── Lists ────────────────────────────────────────────────────────────────────
const NEED = 'need'
function Filters({ value, set }) {
  const opts = [['all', 'ALL'], [NEED, 'NEEDS'], ...POS.map(p => [p, POS_LABEL[p]])]
  return (
    <div className="dr-filters" role="tablist">
      {opts.map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'is-on' : ''} onClick={() => { set(k); tap() }}>{n}</button>)}
    </div>
  )
}
const needSet = F => new Set(Object.entries(needsOf(F, F.team)).filter(([, v]) => v >= 1.5).map(([g]) => g))
const filterBy = (F, list, f) => { if (f === 'all') return list; if (f === NEED) { const s = needSet(F); return list.filter(x => s.has(groupOf(x))) } return list.filter(x => x.p === f) }

// THE CLASS's order: the media's big board (RANK), our own grades (GRADE: only what our scouts have seen; a man we
// haven't scouted has no grade of ours, so he goes to the bottom in the big board's order), or by POSITION (each
// room together, our graded men first). Draft night's BEST AVAILABLE keeps its own order (sortBy 'ours').
const SORTS = [['rank', 'BIG BOARD'], ['grade', 'OUR GRADE'], ['pos', 'POSITION']]
const scouted = x => x.b != null || !!x.kc || /[12]/.test(x.k)
function classOrder(F, list, how, ranks) {
  if (how === 'rank') return list
  const rk = x => ranks.get(x.i) ?? 9999
  const key = new Map(list.map(x => [x.i, scouted(x) ? viewOf(F, x).my : null]))
  const byGrade = (a, b) => { const ka = key.get(a.i), kb = key.get(b.i); if (ka == null || kb == null) return ka == null && kb == null ? rk(a) - rk(b) : ka == null ? 1 : -1; return kb - ka || rk(a) - rk(b) }
  if (how === 'grade') return [...list].sort(byGrade)
  return [...list].sort((a, b) => POS.indexOf(a.p) - POS.indexOf(b.p) || byGrade(a, b))
}
function ClassList({ F, act, open, sortBy = 'consensus' }) {
  const [f, setF] = useState('all')
  const [how, setHow] = useState('rank')
  const [more, setMore] = useState(30)
  const ranks = ranksOf(F)
  const list = useMemo(() => {
    const all = sortBy === 'ours' ? [...F.dc].map(x => ({ x, v: viewOf(F, x).my })).sort((a, b) => b.v - a.v || ranks.get(a.x.i) - ranks.get(b.x.i)).map(e => e.x) : classOrder(F, consensus(F), how, ranks)
    return filterBy(F, all, f)
  }, [F, F.dc.length, F.board.length, F.sc?.u, F.sc?.cmb, F.sc?.ivd?.length, f, sortBy, how]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = list.slice(0, more)
  return (
    <>
      <Filters value={f} set={v => { setF(v); setMore(30) }} />
      {sortBy !== 'ours' && (
        <div className="dr-sort" role="radiogroup" aria-label="Sort the class">
          <span>SORT</span>
          {SORTS.map(([k, n]) => <button key={k} type="button" role="radio" aria-checked={how === k} className={how === k ? 'is-on' : ''} onClick={() => { setHow(k); setMore(30); tap() }}>{n}</button>)}
        </div>
      )}
      {how === 'grade' && sortBy !== 'ours' && <p className="dr-sort-note">Graded by our scouts only. Men we haven't scouted are at the bottom, in big-board order. S is the top grade, above A+.</p>}
      <div className="dr-list">
        {shown.map((x, i) => (
          <Fragment key={x.i}>
            {how === 'pos' && sortBy !== 'ours' && f === 'all' && (i === 0 || shown[i - 1].p !== x.p) && <div className="dr-group">{POS_LABEL[x.p]}<small>{list.filter(y => y.p === x.p).length}</small></div>}
            {how !== 'rank' && sortBy !== 'ours' && i > 0 && scouted(shown[i - 1]) && !scouted(x) && (how === 'grade' || shown[i - 1].p === x.p) && <div className="dr-group is-dim">NOT SCOUTED YET</div>}
            <Prospect F={F} x={x} act={act} rank={ranks.get(x.i)} onOpen={open} delay={Math.min(i, 8) * 30} />
          </Fragment>
        ))}
        {!list.length && <p className="dr-empty">NOBODY LEFT HERE</p>}
      </div>
      {list.length > more && <button type="button" className="dr-more" onClick={() => { setMore(m => m + 30); tap() }}>MORE · {list.length - more}</button>}
    </>
  )
}
function OurBoard({ F, act, open, fixed = false }) {
  const list = F.board.map(id => F.dc.find(x => x.i === id)).filter(Boolean)
  if (!list.length) return <p className="dr-empty">STAR A PROSPECT TO PUT HIM ON THE BOARD</p>
  return (
    <div className="dr-list">
      {list.map((x, i) => (
        <div key={x.i} className="dr-brow">
          <Prospect F={F} x={x} act={act} rank={i + 1} onOpen={open} starOk={!fixed} />
          {!fixed && <span className="dr-move">
            <button type="button" disabled={i === 0} aria-label="Up" onClick={() => { act(X => moveOnBoard(X, x.i, -1)); tap() }}>▲</button>
            <button type="button" disabled={i === list.length - 1} aria-label="Down" onClick={() => { act(X => moveOnBoard(X, x.i, 1)); tap() }}>▼</button>
          </span>}
        </div>
      ))}
    </div>
  )
}
function Mock({ F, open }) {
  const mock = useMemo(() => mockDraft(F, 32), [F, F.dc.length, F.wk, F.phase, F.sc?.cmb]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="dr-mock">
      {mock.map((m, i) => {
        const x = F.dc.find(p => p.i === m.xi)
        if (!x) return null
        return (
          <button type="button" key={m.at} className={`dr-mk${m.s === F.team ? ' is-ours' : ''}`} style={{ ...fkVars(m.s), '--d': `${Math.min(i, 10) * 25}ms` }} onClick={() => { open(x.i); tap() }}>
            <span className="dr-mk-no">{m.at + 1}</span>
            <span className="dr-mk-team"><KLogo s={m.s} size={26} /></span>
            <span className="dr-mk-man"><b>{x.n.toUpperCase()}</b><small>{spotLabel(x)} · {schoolName(x.col)}</small></span>
            <CollegeLogo col={x.col} size={24} />
          </button>
        )
      })}
    </div>
  )
}

// ── Saturdays ────────────────────────────────────────────────────────────────
function Saturday({ F, act, open }) {
  const sl = slateOf(F)
  const [trip, setTrip] = useState(null)
  const moves = stockMoves(F, 6)
  const go = gi => { const g = act(X => attend(X, gi)); if (g) { setTrip({ g, wk: sl.wk }); sfx('whistle'); haptic('medium') } else sfx('deny') }
  const ranks = rankMap(F)
  return (
    <>
      {sl && (
        <section className="dr-sec">
          <Chyron title={sl.label} tag="NCAA" tone="ink" sub={sl.went ? 'A SCOUT WENT THIS WEEK' : 'ONE TRIP A WEEK · 2 DAYS'} />
          {sl.games.map((g, gi) => g.k === 'sb' ? (
            <div key="sb" className="dr-game is-sb">
              <span className="dr-game-sb"><b>SENIOR BOWL</b><small>MOBILE, ALA. · {g.xs.length} SENIORS</small></span>
              {!sl.went && <Go onClick={() => go(gi)} disabled={scoutsLeft(F) < 2} sub="2 DAYS">SEND A SCOUT</Go>}
            </div>
          ) : (
            <div key={gi} className={`dr-game${trip?.g?.h === g.h ? ' is-went' : ''}`} style={{ '--d': `${gi * 70}ms` }}>
              <div className="dr-game-row">
                <GameSide col={g.a} />
                <span className="dr-game-at">AT</span>
                <GameSide col={g.h} right />
              </div>
              <div className="dr-game-foot">
                <span><b>{g.xs.length}</b> PROSPECTS</span>
                {!sl.went && <Go ghost onClick={() => go(gi)} disabled={scoutsLeft(F) < 2} sub="2 DAYS">SEND A SCOUT</Go>}
                {trip?.g?.h === g.h && <Tag tone="w">SCOUTED</Tag>}
              </div>
            </div>
          ))}
        </section>
      )}
      {trip && (
        <section className="dr-sec">
          <Chyron title="FROM THE PRESS BOX" tone="ink" size="s" sub={trip.g.k === 'sb' ? 'SENIOR BOWL WEEK' : `${schoolName(trip.g.a)} AT ${schoolName(trip.g.h)}`} />
          <div className="dr-list">
            {trip.g.xs.map(id => F.dc.find(x => x.i === id)).filter(Boolean).sort((a, b) => ranks.get(a.i) - ranks.get(b.i)).slice(0, 14).map((x, i) => (
              <Prospect key={x.i} F={F} x={x} act={act} rank={ranks.get(x.i)} onOpen={open} delay={i * 60} line={trip.g.k === 'sb' ? null : lineText(x.p, gameLine(x, trip.wk + 1))} />
            ))}
          </div>
        </section>
      )}
      {moves.length > 0 && (
        <section className="dr-sec">
          <Chyron title="STOCK WATCH" tone="ink" size="s" sub="THE CONSENSUS BOARD THIS WEEK" />
          <div className="dr-list">
            {moves.map(e => (
              <Prospect key={e.x.i} F={F} x={e.x} act={act} onOpen={open} starOk={false}
                right={<span className={`dr-move-v ${e.d > 0 ? 'is-up' : 'is-down'}`}><b>{e.d > 0 ? '▲' : '▼'}{Math.abs(e.d)}</b><small>NO. {e.rank}</small></span>} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
function GameSide({ col, right }) {
  const t = school(col)
  return (
    <span className={`dr-gs${right ? ' is-r' : ''}`} style={colVars(col)}>
      <CollegeLogo col={col} size={34} />
      <span className="dr-gs-txt">{t?.ap ? <small>NO. {t.ap}</small> : <small>{(t?.conf ?? '').toUpperCase()}</small>}<b>{(t?.school ?? col).toUpperCase()}</b></span>
    </span>
  )
}

// ── The spring: the combine, pro days ────────────────────────────────────────
function Spring({ F, act, open }) {
  const ranks = rankMap(F)
  const ran = F.dc.map(x => ({ x, c: combineOf(x) })).filter(e => e.c && !e.c.dnp)
  const fast = ran.filter(e => e.c.f40).sort((a, b) => a.c.f40 - b.c.f40).slice(0, 5)
  const strong = ran.filter(e => e.c.bench).sort((a, b) => b.c.bench - a.c.bench)[0]
  const hops = ran.filter(e => e.c.vert).sort((a, b) => b.c.vert - a.c.vert)[0]
  // pro days: the schools with the most men on our board, then the most prospects
  const schools = useMemo(() => {
    const m = new Map()
    for (const x of F.dc) if (x.col && x.b == null) { const e = m.get(x.col) ?? { col: x.col, n: 0, ours: 0 }; e.n++; if (F.board.includes(x.i)) e.ours++; m.set(x.col, e) }
    return [...m.values()].sort((a, b) => b.ours - a.ours || b.n - a.n).slice(0, 6)
  }, [F, F.board.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const pd = col => { const ok = act(X => proDay(X, col)); if (ok) { sfx('whistle'); haptic('medium') } else sfx('deny') }
  return (
    <>
      <section className="dr-sec">
        <Chyron title="THE COMBINE" tag="40" tone="ink" sub="FASTEST 40-YARD DASH TIMES" />
        <div className="dr-list">
          {fast.map((e, i) => <Prospect key={e.x.i} F={F} x={e.x} act={act} rank={ranks.get(e.x.i)} onOpen={open} delay={i * 60} right={<span className="dr-time"><b>{e.c.f40.toFixed(2)}</b><small>SEC</small></span>} />)}
        </div>
        <div className="dr-facts is-row">
          {strong && <button type="button" className="dr-cf is-tap" onClick={() => open(strong.x.i)}><b>{strong.c.bench}</b><small>BENCH REPS · {splitName(strong.x.n).last.toUpperCase()}</small></button>}
          {hops && <button type="button" className="dr-cf is-tap" onClick={() => open(hops.x.i)}><b>{hops.c.vert}"</b><small>VERTICAL · {splitName(hops.x.n).last.toUpperCase()}</small></button>}
        </div>
      </section>
      <section className="dr-sec">
        <Chyron title="PRO DAYS" tone="ink" size="s" sub="2 DAYS EACH" />
        <div className="dr-pds">
          {schools.map(s => {
            const went = F.sc.pdd.includes(s.col)
            return (
              <button key={s.col} type="button" className={`dr-pd${went ? ' is-went' : ''}`} style={colVars(s.col)} disabled={went || scoutsLeft(F) < 2} onClick={() => pd(s.col)}>
                <CollegeLogo col={s.col} size={30} />
                <span><b>{schoolName(s.col)}</b><small>{went ? 'ATTENDED' : `${s.n} PROSPECTS${s.ours ? ` · ${s.ours} ON OUR BOARD` : ''}`}</small></span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

// ── The scouting room ────────────────────────────────────────────────────────
function ScoutTop({ F, act }) {
  const left = scoutsLeft(F)
  const spring = springOn(F)
  return (
    <div className="dr-top">
      <span className="dr-days"><BigNum v={left} size={40} label="SCOUTING DAYS" /></span>
      {spring ? <span className="dr-days"><BigNum v={visitsLeft(F)} size={40} label="TOP-30 VISITS" /></span> : <span className="dr-days is-dim"><b>+{PER_WEEK(F)}</b><small>EVERY WEEK</small></span>}
      {canScout(F) && left > 0 && <button type="button" className="dr-auto" onClick={() => { const n = act(X => autoScout(X)); sfx(n ? 'flip' : 'deny') }}>SCOUTS' CHOICE</button>}
    </div>
  )
}
export function ScoutRoom({ F, act, onPick }) {
  const spring = springOn(F)
  const [tab, setTab] = useState(spring ? 'spring' : 'week')
  const [open, setOpen] = useState(null)
  useEffect(() => { act(X => { syncScouts(X); if (springOn(X) && !X.sc?.cmb) runCombine(X) }) }, [spring]) // eslint-disable-line react-hooks/exhaustive-deps
  const onBoard = F.board.filter(id => F.dc.some(x => x.i === id)).length
  const tabs = [[spring ? 'spring' : 'week', spring ? 'COMBINE' : 'SATURDAY'], ['board', 'OUR BOARD'], ['class', 'THE CLASS'], ['mock', 'MOCK']]
  return (
    <>
      <ScoutTop F={F} act={act} />
      <div className="dr-tabs" role="tablist">
        {tabs.map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => { setTab(k); tap() }}>{n}{k === 'board' && onBoard ? <i>{onBoard}</i> : null}</button>)}
      </div>
      {tab === 'week' && <Saturday F={F} act={act} open={setOpen} />}
      {tab === 'spring' && <Spring F={F} act={act} open={setOpen} />}
      {tab === 'board' && <OurBoard F={F} act={act} open={setOpen} />}
      {tab === 'class' && <ClassList F={F} act={act} open={setOpen} />}
      {tab === 'mock' && <><Chyron title={`MOCK DRAFT ${mockVersion(F)}`} tone="ink" size="s" sub="THE MEDIA'S FIRST ROUND" /><Mock F={F} open={setOpen} /></>}
      {open != null && <ProspectCard F={F} act={act} id={open} onClose={() => setOpen(null)} onDraft={onPick} />}
    </>
  )
}
// The scouting room as a sheet over the hub (the hub's DRAFT BOARD)
export default function DraftBoard({ F, act, onClose }) {
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return createPortal(
    <div className="dr-room fk" style={fkVars(F.team)}>
      <header className="dr-head">
        <Chyron team={F.team} title="SCOUTING" tag={F.year + 1} size="l" sub={`${F.year + 1} NFL DRAFT · ${F.dc.length} PROSPECTS`} />
        <button type="button" className="dr-close" onClick={() => { onClose(); tap() }} aria-label="Close">✕</button>
      </header>
      <div className="dr-body"><ScoutRoom F={F} act={act} /></div>
    </div>,
    document.body,
  )
}

// ── Draft day ────────────────────────────────────────────────────────────────
const CLOCK = [600, 420, 300, 300, 300, 300, 240]   // the real draft's clock by round: 10 minutes in the 1st, 7 in the 2nd, 5, then 4 in the 7th
const DAY_OF = rd => (rd === 1 ? 'DAY 1' : rd <= 3 ? 'DAY 2' : 'DAY 3')
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// (light: Franchise LIGHT's draft: the player picks in rounds 1-3, the league's picks a quick feed, no trades, then
// SIM THE REST OF THE DRAFT; light.js)
export function DraftDay({ F, act, owner, onBuild, light = false }) {
  if (F.dr.ph === 'pre') return <DraftWeek F={F} act={act} onBuild={onBuild} />
  if (draftDone(F) && F.dr.over) return <ClassRecap F={F} act={act} owner={owner} />
  return <DraftNight F={F} act={act} gm={owner && !/^guest$/i.test(owner) ? owner : null} light={light} />
}

function DraftWeek({ F, act, onBuild }) {
  const [room, setRoom] = useState(false)
  const [add, setAdd] = useState(false)
  const sandbox = sandboxOn() && !!onBuild
  const mine = myPicks(F)
  const ranks = rankMap(F)
  const top = (F.board.length ? F.board.map(id => F.dc.find(x => x.i === id)).filter(Boolean) : consensus(F)).slice(0, 5)
  return (
    <div className="dr-day fk" style={fkVars(F.team)}>
      <Chyron team={F.team} title="DRAFT WEEK" tag={F.year + 1} size="l" sub={`${TEAM[F.team].nick.toUpperCase()} · ${mine.length} PICKS`} />
      <div className="dr-picks-strip">
        {mine.map(at => <span key={at} className="dr-chip"><small>RD {roundOf(at)}</small><b>{at + 1}</b></span>)}
      </div>
      <section className="dr-sec">
        <Chyron title={F.board.length ? 'OUR BOARD' : 'CONSENSUS BOARD'} tone="ink" size="s" sub="TOP 5" />
        <div className="dr-list">{top.map((x, i) => <Prospect key={x.i} F={F} x={x} rank={F.board.length ? i + 1 : ranks.get(x.i)} onOpen={() => setRoom(true)} delay={i * 50} />)}</div>
      </section>
      {sandbox && (
        <section className="dr-sec dr-sandbox">
          <Chyron title="SANDBOX" tone="ink" size="s" sub="A BUILD INTO THE CLASS" />
          <button type="button" className={`dr-add${add ? ' is-on' : ''}`} aria-expanded={add} onClick={() => { setAdd(!add); tap() }}>{add ? 'Pick his position' : '+ Add a prospect'}</button>
          {add && <div className="dr-addpos">{POS.map(p => <button key={p} type="button" onClick={() => { tap(); onBuild({ id: 'prospect', pos: p, n: 1, of: 1 }) }}>{POS_LABEL[p]}</button>)}</div>}
        </section>
      )}
      <ActionBar>
        <Go onClick={() => { act(X => startNight(X)); sfx('whistle'); haptic('medium') }}>Start the draft</Go>
        <Go ghost onClick={() => { setRoom(true); tap() }}>Scouting room</Go>
      </ActionBar>
      {room && <DraftBoard F={F} act={act} onClose={() => setRoom(false)} />}
    </div>
  )
}

// Draft night. The league's picks come up one at a time (the first round as cards, then a running list), the
// trades with them; on our pick, the clock, the board, the trade offers; our pick is turned over.
function DraftNight({ F, act, gm, light = false }) {
  // the picks not yet shown live on the draft itself (F.dr.seen), so a reload or a remount picks up where it was;
  // base: where this run of the feed starts (the first pick not shown when it began)
  const [base, setBase] = useState(() => F.dr.seen ?? 0)
  const feed = F.dr.picks.slice(base)
  const [shown, setShown] = useState(0)
  const [reveal, setReveal] = useState(() => (F.dr.rv != null ? F.dr.picks.find(p => p.at === F.dr.rv) ?? null : null))
  const [offers, setOffers] = useState(null)
  const [open, setOpen] = useState(null)
  const [f, setF] = useState(() => (F.board.some(id => F.dc.some(x => x.i === id)) ? 'board' : 'best'))
  const T = useRef(0)
  const at = F.dr.at
  const done = draftDone(F)
  const onClock = !done && pickTeam(F) === F.team
  const showing = shown < feed.length
  const fresh = fn => X => { X.dr.seen = X.dr.picks.length; return fn(X) }
  const run = () => { setBase(F.dr.picks.length); setShown(0); setOffers(null); const made = act(fresh(X => cpuPicks(X))); if (made?.length) sfx('swap') }
  // (read live: the draft object is mutated in place, and a dev remount runs this twice)
  useEffect(() => { if (!draftDone(F) && pickTeam(F) !== F.team && F.dr.picks.length === (F.dr.seen ?? 0)) run() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showing) return
    const big = roundOf(feed[shown].at) === 1
    T.current = setTimeout(() => { setShown(n => n + 1); sfx(big && !light ? 'card' : 'tick') }, reduced() ? 40 : light ? 60 : big ? (shown === 0 ? 350 : 700) : 90)
    return () => clearTimeout(T.current)
  }, [showing, shown, feed.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // (each pick counts as seen once it's been on screen, so a reload picks up after the last one shown and never
  // replays the night; the save is written every first-round card and every few picks after that)
  useEffect(() => {
    if (shown <= 0) return
    markSeen(F, base + shown)
    if (shown >= feed.length || roundOf(feed[shown - 1].at) === 1 || shown % 8 === 0) act(() => {})
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps
  // (our pick: the reveal is on screen until NEXT PICK; F.dr.rv keeps it there through a reload)
  const mark = X => { X.dr.seen = X.dr.picks.length }
  const take = x => { const pk = act(X => { const p = userPick(X, x.i); mark(X); if (p) X.dr.rv = p.at; return p }); if (pk) { setOpen(null); setBase(F.dr.picks.length); setShown(0); setReveal(pk); sfx('card', 2); haptic('success') } }
  const auto = () => { const pk = act(X => { const p = autoPick(X); mark(X); if (p) X.dr.rv = p.at; return p }); if (pk) { setBase(F.dr.picks.length); setShown(0); setReveal(pk); sfx('card', 2) } }
  const next = () => { setReveal(null); act(X => { delete X.dr.rv }); if (!draftDone(F) && pickTeam(F) !== F.team) run() }
  const finish = () => { act(X => { X.dr.over = 1; delete X.dr.rv }); sfx('whistle') }
  const trade = o => { if (act(X => acceptTrade(X, o))) { sfx('claim'); haptic('success'); setOffers(null); if (pickTeam(F) !== F.team) run() } }
  const trades = new Map(F.dr.tr.filter(t => !t.mine).map(t => [t.at, t]))
  // (LIGHT: from the 4th round on, the rest of the draft in one go: the league's picks and the player's auto picks)
  const nextMine = myPicks(F)[0]
  const rest = light && !done && (nextMine == null || roundOf(nextMine) >= 4)
  const simAll = () => { setReveal(null); setBase(F.dr.picks.length); setShown(0); act(X => { simRest(X); X.dr.seen = X.dr.picks.length; X.dr.over = 1; delete X.dr.rv }); sfx('whistle'); haptic('medium') }

  if (reveal) return <RevealCard F={F} p={reveal} onNext={draftDone(F) ? finish : rest ? simAll : next} label={rest ? 'Sim the rest of the draft' : null} />
  const cur = showing ? feed[shown] : null
  const recent = F.dr.picks.slice(0, base + shown).reverse()
  return (
    <div className="dr-day dr-night fk" style={fkVars(F.team)}>
      {!done && <Clock F={F} at={cur ? cur.at : at} team={cur ? cur.s : pickTeam(F)} ours={onClock && !showing} nextMine={nextMine} />}
      {done && <Chyron team={F.team} title="THE DRAFT IS OVER" tag={F.year + 1} size="l" sub={`${F.dr.picks.length} PICKS · 7 ROUNDS`} />}
      {done && !showing && F.dr.picks.length > 0 && <PickCard F={F} p={F.dr.picks[F.dr.picks.length - 1]} label="MR. IRRELEVANT" />}
      {cur && roundOf(cur.at) === 1 && !light && <PickCard key={cur.at} F={F} p={cur} trade={trades.get(cur.at)} />}
      {recent.length > 0 && (
        <section className="dr-feed">
          {recent.slice(0, showing ? 6 : 10).map(p => <FeedRow key={p.at} F={F} p={p} trade={trades.get(p.at)} />)}
        </section>
      )}
      {showing && <button type="button" className="dr-skip" onClick={() => { setShown(feed.length); tap() }}>Skip ahead</button>}
      {!showing && onClock && !rest && (
        <>
          <p className="dr-tip">{gm ? `${gm}, the ${TEAM[F.team].nick} are on the clock.` : `The ${TEAM[F.team].nick} are on the clock.`} Tap a prospect to see his card and draft him.</p>
          <div className="dr-acts">
            <Go ghost onClick={auto}>Auto pick</Go>
            {!light && <Go ghost onClick={() => { setOffers(offers ? null : act(X => tradeDownOffers(X))); tap() }}>Trade down</Go>}
          </div>
          {offers && <Offers F={F} offers={offers} onTake={trade} />}
          <div className="dr-tabs is-small" role="tablist">
            {[['board', 'OUR BOARD'], ['best', 'BEST AVAILABLE']].map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={f === k} className={f === k ? 'is-on' : ''} onClick={() => { setF(k); tap() }}>{n}</button>)}
          </div>
          {f === 'board' ? <OurBoard F={F} act={act} open={setOpen} fixed /> : <ClassList F={F} act={act} open={setOpen} sortBy="ours" />}
          {open != null && <ProspectCard F={F} act={act} id={open} onClose={() => setOpen(null)} onDraft={take} draftLabel={`DRAFT HIM · NO. ${at + 1}`} />}
        </>
      )}
      {!showing && !onClock && !done && !rest && (
        <>
          {offers && <Offers F={F} offers={offers} onTake={trade} />}
          <ActionBar>
            <Go onClick={run}>{nextMine != null ? `Sim to pick ${nextMine + 1}` : 'Finish the draft'}</Go>
            {!light && <Go ghost onClick={() => { setOffers(offers ? null : act(X => tradeUpOffers(X))); tap() }}>Trade up</Go>}
          </ActionBar>
        </>
      )}
      {!showing && rest && <ActionBar><Go onClick={simAll} sub={`ROUNDS ${roundOf(Math.max(at, nextMine ?? at))}-7 · THE SCOUTS' PICKS`}>Sim the rest of the draft</Go></ActionBar>}
      {!showing && !done && !light && roundOf(at) >= 4 && <button type="button" className="dr-skip" onClick={() => { setBase(F.dr.picks.length); setShown(0); act(fresh(X => simRest(X))); sfx('flip') }}>Auto-draft the rest</button>}
      {!showing && done && <ActionBar><Go onClick={finish}>See the class</Go></ActionBar>}
    </div>
  )
}
function Clock({ F, at, team, ours, nextMine }) {
  const rd = roundOf(at)
  const [left, setLeft] = useState(CLOCK[rd - 1])
  useEffect(() => {
    setLeft(CLOCK[rd - 1])
    if (!ours || reduced()) return
    const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [at, ours, rd])
  return (
    <div className={`dr-clock${ours ? ' is-ours' : ''}`} style={fkVars(team)}>
      <span className="dr-clock-tag"><small>{DAY_OF(rd)}</small><b>RD {rd}</b></span>
      <span className="dr-clock-team"><KLogo s={team} size={34} /><span><small>{ours ? 'ON THE CLOCK' : 'THE PICK IS IN'}</small><b>{TEAM[team]?.nick.toUpperCase()}</b></span></span>
      <span className="dr-clock-no"><small>PICK</small><b>{at + 1}</b></span>
      {ours && <span className="dr-clock-t"><b>{mmss(left)}</b></span>}
      {!ours && nextMine != null && <span className="dr-clock-next">{F.team} NEXT · NO. {nextMine + 1}</span>}
    </div>
  )
}
// a first-round pick, announced: the team's slab, the man under it (in his draft-night suit)
function PickCard({ F, p, trade, label }) {
  const t = TEAM[p.s]
  const { first, last } = splitName(p.n)
  return (
    <div className="dr-pc" style={fkVars(p.s)}>
      <div className="dr-pc-top"><KLogo s={p.s} size={40} /><span><small>{label ? `PICK ${p.at + 1} · ${label}` : trade ? `PICK ${p.at + 1} · VIA TRADE WITH ${TEAM[trade.down].nick.toUpperCase()}` : `PICK ${p.at + 1}`}</small><b>THE {t.nick.toUpperCase()} SELECT</b></span></div>
      <div className="dr-pc-man">
        <span className="dr-pc-face" style={colVars(p.col)}><img src={faceFor(F, p, SUIT)} alt="" draggable={false} /></span>
        <span className="dr-pc-name"><small>{first}</small><b>{last}</b><em>{pickSpot(p)} · {schoolName(p.col)}</em></span>
        <CollegeLogo col={p.col} size={34} />
      </div>
    </div>
  )
}
function FeedRow({ F, p, trade }) {
  return (
    <>
      {trade && <div className="dr-fr is-trade"><Tag tone="team">TRADE</Tag><span>{TEAM[trade.up].nick.toUpperCase()} MOVE UP TO NO. {trade.at + 1} WITH {TEAM[trade.down].nick.toUpperCase()}</span></div>}
      <div className={`dr-fr${p.s === F.team ? ' is-ours' : ''}`} style={fkVars(p.s)}>
        <span className="dr-fr-no">{p.at + 1}</span>
        <KLogo s={p.s} size={22} />
        <b>{p.n.toUpperCase()}</b>
        <small>{pickSpot(p)}</small>
        <CollegeLogo col={p.col} size={20} />
      </div>
    </>
  )
}
function Offers({ F, offers, onTake }) {
  if (!offers.length) return <p className="dr-empty">NO OFFERS</p>
  const lbl = k => `RD ${roundOf(k)} · NO. ${k + 1}`
  return (
    <div className="dr-offers">
      {offers.map((o, i) => (
        <div key={i} className="dr-offer">
          <span className="dr-offer-t" style={fkVars(o.with)}><KLogo s={o.with} size={30} /><b>{TEAM[o.with].nick.toUpperCase()}</b></span>
          <span className="dr-offer-x"><small>{F.team} GETS</small>{o.get.map(k => <b key={k}>{lbl(k)}</b>)}</span>
          <span className="dr-offer-x"><small>{o.with} GETS</small>{o.give.map(k => <b key={k}>{lbl(k)}</b>)}</span>
          <Go onClick={() => onTake(o)}>ACCEPT</Go>
        </div>
      ))}
    </div>
  )
}
// Our pick, turned over: the announcement, the card flips, the grade he really is spins up, the stamp.
function RevealCard({ F, p, onNext, label = null }) {
  const [flip, setFlip] = useState(false)
  useEffect(() => { const t = setTimeout(() => { setFlip(true); sfx('gradepop', 6) }, reduced() ? 0 : 700); return () => clearTimeout(t) }, [])
  const t = TEAM[F.team]
  const { first, last } = splitName(p.n)
  const man = F.teams[F.team].r.find(q => q.i === p.pid), nu = man ? jersey(F, man) : null
  const rank = p.rk ?? boardRank(F).get(p.xi)
  return (
    <div className="dr-day dr-reveal fk" style={fkVars(F.team)}>
      <p className="dr-announce">WITH THE {ord(p.at + 1)} PICK IN THE {F.year + 1} NFL DRAFT, THE {t.name.toUpperCase()} SELECT</p>
      <Flip open={flip} className="dr-rv-flip"
        back={<div className="dr-rv-back"><KLogo s={F.team} size={96} /><b>RD {roundOf(p.at)} · PICK {p.at + 1}</b></div>}
        front={(
          <div className="dr-rv-front">
            <span className="dr-rv-slab"><span className="dr-rv-num">{nu ?? ''}</span><img src={faceFor(F, p, teamKit(t.short) ?? t.color)} alt="" draggable={false} /></span>
            <span className="dr-rv-name"><small>{first}</small><b>{last}</b><em>{pickSpot(p)} · {schoolName(p.col)}{man ? ` · ${man.o} OVR` : ''}</em></span>
          </div>
        )} />
      {flip && (
        <div className="dr-rv-grades">
          <span className="dr-gr"><small>OUR GRADE</small><b>{p.my != null ? gradeOf(p.my) : '—'}</b></span>
          <span className="dr-gr"><small>CONSENSUS</small><b>{rank ? `NO. ${rank}` : '—'}</b></span>
          <span className="dr-gr is-true"><small>TRUE GRADE</small><b>{gradeOf(p.pk)}</b></span>
        </div>
      )}
      {flip && <p className="dr-rv-note">Grades are where he's headed. He starts at {man?.o ?? '—'} OVR.</p>}
      <ActionBar><Go onClick={onNext}>{draftDone(F) ? 'See the class' : label ?? 'Next pick'}</Go></ActionBar>
    </div>
  )
}

// ── After the draft: our class, how good the scouting was, the league's gems and busts ──
function ClassRecap({ F, act, owner }) {
  const rv = useMemo(() => draftReview(F), [F, F.dr.picks.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [n, setN] = useState(() => (reduced() ? 99 : 0))
  useEffect(() => { if (n > rv.mine.length + 1) return; const t = setTimeout(() => setN(k => k + 1), 380); return () => clearTimeout(t) }, [n, rv.mine.length])
  const nu = p => { const man = F.teams[F.team].r.find(q => q.i === p.pid); return man ? jersey(F, man) : null }
  return (
    <div className="dr-day fk" style={fkVars(F.team)}>
      <Chyron team={F.team} title="DRAFT CLASS" tag={F.year + 1} size="l" sub={`${TEAM[F.team].nick.toUpperCase()} · ${rv.mine.length} ${rv.mine.length === 1 ? 'PICK' : 'PICKS'}${owner && !/^guest$/i.test(owner) ? ` · GM ${owner.toUpperCase()}` : ''}`} />
      <div className="dr-list">
        {rv.mine.map((p, i) => i < n && (
          <div key={p.at} className="dr-cls">
            <span className="dr-cls-no"><small>RD {roundOf(p.at)}</small><b>{p.at + 1}</b></span>
            <span className="dr-p-slab" style={fkVars(F.team)}><span className="dr-p-num">{nu(p)}</span><img className="dr-p-face" src={faceFor(F, p, teamKit(F.team) ?? TEAM[F.team].color, true)} alt="" loading="lazy" decoding="async" draggable={false} /></span>
            <span className="dr-p-bar"><span className="dr-p-name"><small>{splitName(p.n).first}</small><b>{splitName(p.n).last}</b></span><span className="dr-p-meta"><em>{pickSpot(p)}</em><CollegeLogo col={p.col} size={15} /><span>{schoolName(p.col)}</span></span></span>
            <span className="dr-cls-o"><small>OURS</small><b>{p.my != null ? gradeOf(p.my) : '—'}</b></span>
            <span className="dr-cls-g"><small>TRUE</small><b>{gradeOf(p.pk)}</b></span>
            {p.tag !== 'S' && <span className="dr-cls-stamp"><Stamp kind={p.tag === 'G' ? 'gem' : 'bust'}>{TAG_TEXT[p.tag]}</Stamp></span>}
          </div>
        ))}
        {!rv.mine.length && <p className="dr-empty">NO PICKS THIS YEAR</p>}
      </div>
      {n > rv.mine.length && rv.grade && (
        <div className="dr-score">
          <span className="dr-gr is-true"><small>OUR SCOUTING</small><b>{rv.grade}</b></span>
          <span className="dr-gr"><small>THE MEDIA</small><b>{rv.mediaGrade}</b></span>
          <span className="dr-gr"><small>MISSED BY</small><b>{rv.myErr}</b><em>OVR A PICK</em></span>
        </div>
      )}
      {n > rv.mine.length + 1 && (
        <>
          {rv.gems.length > 0 && <section className="dr-sec"><Chyron title="GEMS OF THE DRAFT" tone="ink" size="s" sub="UNDERRATED BY THE CONSENSUS" />{rv.gems.map(p => <LeaguePick key={p.at} p={p} kind="gem" />)}</section>}
          {rv.busts.length > 0 && <section className="dr-sec"><Chyron title="BUSTS" tone="ink" size="s" sub="OVERRATED BY THE CONSENSUS" />{rv.busts.map(p => <LeaguePick key={p.at} p={p} kind="bust" />)}</section>}
        </>
      )}
      <ActionBar><Go onClick={() => { act(X => { if (X.pace === 'light') lightNewSeason(X); else { closeDraft(X); newSeason(X) } }); sfx('whistle'); haptic('medium') }}>Start the {F.year + 1} season</Go></ActionBar>
    </div>
  )
}
const LeaguePick = ({ p, kind }) => (
  <div className="dr-fr is-big" style={fkVars(p.s)}>
    <span className="dr-fr-no">{p.at + 1}</span>
    <KLogo s={p.s} size={26} />
    <b>{p.n.toUpperCase()}</b>
    <small>{pickSpot(p)} · {gradeOf(p.pk)}</small>
    <Stamp kind={kind} quiet>{kind === 'gem' ? 'GEM' : 'BUST'}</Stamp>
  </div>
)
