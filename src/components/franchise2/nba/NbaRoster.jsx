import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  TEAM, CONF_OF, SHORTS, CONF_DIVS, DIVS, records, recText, confOrder, coachOrder, teamOvr, myGames, nextMine, dateText, seasonText, CAP_SIM,
  nick, addNews, manOf, teamOfMan, b2bOf, TYPES, cutBlock, careerView, retiredRow, FIRST_YEAR, photoOf } from '../../../lib/franchise2/nba'
import { GUARD_CATEGORIES } from '../../../data/nba-guards'
import { BIG_CATEGORIES } from '../../../data/nba-bigs'
import { BUCKET_ATTR } from '../../../data/nba-attrs'
import { valToGrade } from '../../../utils/simulation'
import { manPhoto } from './NbaBuilds'
import { sfx } from '../../../lib/juice'
import { fkVars, KLogo, LowerThird, Chyron, BackBar, Tag, TeamSlab, Fact } from '../kit'

// THE ROSTERS: the GM's rotation (the order, the starters, the minutes he wants for a man), any team's roster, a
// man's page (his ratings, his contract year by year, his career) and the GM's schedule, the whole season of it.
const money = v => (v == null ? '-' : `$${(Math.round(v * 10) / 10).toFixed(1)}M`)
const ORD = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
const isPo = F => F.phase === 'playin' || F.phase === 'playoffs'
export const perGameLine = (F, p, all = false) => {
  const x = F.ss?.[p.i]
  if (!x?.gp || F.phase === 'off') return null
  const f = k => (x[k] / x.gp).toFixed(1)
  return all ? `${f('pts')} PPG · ${f('reb')} RPG · ${f('ast')} APG` : `${f('pts')} PPG · ${p.g === 'big' ? `${f('reb')} RPG` : `${f('ast')} APG`}`
}
const dealLine = p => (p.tw ? 'TWO-WAY' : p.y > 0 ? `${money(p.$)} · ${p.y} ${p.y === 1 ? 'YR' : 'YRS'}` : 'DEAL UP')
// an injury in a few words for a row: the part, the games ("ANKLE · 8 G"); the whole of it on his page
export const injShort = inj => {
  if (!inj) return ''
  const part = String(inj.k ?? '').replace(/^(sprained|strained|torn|broken|ruptured|sore|bruised)\s+/i, '').replace(/^stress fracture in his\s+/i, '')
    .replace(/^(left|right)\s+/i, '').replace(/\s+(soreness|spasms|contusion|protocol)$/i, '')
  return `${part.toUpperCase()} · ${inj.se ? 'SEASON' : `${inj.g} G`}`
}
const heightText = ht => (ht ? `${Math.floor(ht / 12)}'${ht % 12}"` : '')

// ── The rotation (the GM's team) ─────────────────────────────────────────────
// the coach's order, the first five start; EDIT: tap a man, then another, to swap them (a bench man for a starter, two
// places on the bench), and − / + for the minutes he wants a man to play (the rest share what's left of the 240)
export function Rotation({ F, act, owner, onMan }) {
  const [edit, setEdit] = useState(false)
  const [pick, setPick] = useState(null)
  const t = F.teams[F.team]
  const opts = { playoff: isPo(F) }
  const rot = CAP_SIM.rotationOf(F, F.team, opts)
  const mins = Object.fromEntries(rot.map(x => [x.i, x.min]))
  const order = coachOrder(F, F.team, CAP_SIM.rotationOf, opts).filter(p => !p.tw)
  const hurt = t.r.filter(p => p.inj?.g && !p.tw)
  const custom = !!(t.rot || (t.min && Object.keys(t.min).length))
  const swap = (a, b) => act(X => {
    const ids = coachOrder(X, X.team, CAP_SIM.rotationOf, opts).filter(x => !x.tw).map(x => x.i)
    const i = ids.indexOf(a), j = ids.indexOf(b)
    if (i < 0 || j < 0) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    X.teams[X.team].rot = ids
  })
  const tap = id => {
    if (pick == null) { setPick(id); sfx('tap'); return }
    if (pick !== id) { swap(pick, id); sfx('flip') }
    setPick(null)
  }
  const reset = () => { act(X => { X.teams[X.team].rot = null; X.teams[X.team].min = null }); setPick(null); sfx('back') }
  const right = edit ? <button type="button" className="nb-auto" onClick={() => { setEdit(false); setPick(null); sfx('tap') }}>DONE</button>
    : <span className="nb-chy-acts">{custom && <button type="button" className="nb-auto" onClick={reset}>AUTO</button>}<button type="button" className="nb-auto" onClick={() => { setEdit(true); sfx('tap') }}>EDIT</button></span>
  return (
    <>
      <Chyron team={F.team} title="Rotation" sub={`TEAM OVR ${teamOvr(F, F.team)} · ${t.r.filter(p => !p.tw).length} OF 15 STANDARD`} right={right} />
      {edit && <p className="nb-ed-hint">Tap a player, then another, to swap them. Set the minutes you want a player to get; the coach splits the rest of the 240.</p>}
      <div className={`nb-rot${edit ? ' is-edit' : ''}`}>
        {order.map((p, k) => (
          <div key={p.i} className="nb-rot-grp">
            {(k === 0 || k === 5) && <span className="nb-rot-sh">{k === 0 ? 'Starters' : 'Bench'}</span>}
            {edit ? <EditRow F={F} act={act} p={p} k={k} min={mins[p.i] ?? 0} picked={pick === p.i} onTap={() => tap(p.i)} />
              : (
                <div className="nb-rot-row">
                  <MinCell v={mins[p.i]} set={t.min?.[p.i] != null} />
                  <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" mine={p.b != null ? owner : null} line={(p.b != null ? perGameLine(F, p)?.split(' · ')[0] : perGameLine(F, p)) ?? `AGE ${p.ag} · ${dealLine(p)}`} onClick={() => { onMan(p.i); sfx('tap') }} />
                </div>
              )}
          </div>
        ))}
        {hurt.length > 0 && <span className="nb-rot-sh">Injured</span>}
        {hurt.map(p => (
          <div key={p.i} className="nb-rot-row is-out">
            <span className="nb-rot-k"><Tag tone="inj">OUT</Tag></span>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={injShort(p.inj)} onClick={() => onMan(p.i)} />
          </div>
        ))}
      </div>
      {edit && custom && <button type="button" className="fh-textbtn" onClick={reset}>Back to the coach's rotation</button>}
    </>
  )
}
const MinCell = ({ v, set }) => (
  <span className={`nb-rot-k${set ? ' is-set' : ''}`}>{v > 0 ? <><b>{Math.round(v)}</b><small>MIN</small></> : <small>DNP</small>}</span>
)
// one man in the edit: his place, his name (tap to pick him up / put him down), his minutes
function EditRow({ F, act, p, k, min, picked, onTap }) {
  const T = F.teams[F.team]
  const set = T.min?.[p.i]
  const v = set ?? Math.round(min)
  return (
    <div className={`nb-ed-row${picked ? ' is-pick' : ''}`}>
      <button type="button" className="nb-ed-man" onClick={onTap} aria-pressed={picked}>
        <i>{k + 1}</i><span><b>{p.n}</b><small>{p.p} · {p.o} OVR{p.b != null ? ' · ★' : ''}</small></span>
      </button>
      <MinStep F={F} act={act} id={p.i} v={v} set={set != null} />
    </div>
  )
}
// − / + two minutes at a time, 0 (out of the rotation) to 40
export function MinStep({ act, id, v, set }) {
  const put = to => { act(X => { const T = X.teams[X.team]; T.min = { ...(T.min ?? {}), [id]: Math.max(0, Math.min(40, to)) } }); sfx('tap') }
  return (
    <span className="nb-ed-min" role="group" aria-label="Minutes">
      <button type="button" aria-label="Fewer minutes" disabled={v <= 0} onClick={() => put(Math.round(v) - 2)}>−</button>
      <b className={set ? 'is-set' : ''}>{v > 0 ? Math.round(v) : 'DNP'}</b>
      <button type="button" aria-label="More minutes" disabled={v >= 40} onClick={() => put(Math.round(v) + 2)}>+</button>
    </span>
  )
}

// ── A man's page ─────────────────────────────────────────────────────────────
// any man in the league (or on the street): his card, the facts, this season, his ratings as the build page grades
// them, his contract a season at a time, his career. The GM's own: the rotation, an extension, waive.
// (read-only unless act is passed and he is on the GM's roster: a free agent, a draft pick, another team's man and
// a retired man get the page without the Waive, minutes or extension controls)
export const retiredOf = (F, id) => (F.retired ?? []).find(r => r.i === id) ?? null
// (can a tap on this id open a page: a man in the league, on the street, in the draft class, or on the retired list)
export const canOpenMan = (F, id) => id != null && !!(manOf(F, id) || retiredOf(F, id))
export function PlayerSheet({ F, act, id, owner, onClose }) {
  const p = manOf(F, id)
  const s = teamOfMan(F, id)
  const mine = !!act && s === F.team
  const r = !p ? retiredOf(F, id) : null
  if (!p && !r) return null
  if (!p) return <RetiredSheet F={F} r={retiredRow(r)} owner={owner} onClose={onClose} />
  // (a man in the draft class: drafted tonight, or still on the board; he signs when the draft closes)
  const pros = !s && (F.dc ?? []).includes(p)
  const kit = s ?? (pros && p.dt) ?? (p.fr && TEAM[p.fr] ? p.fr : null) ?? F.team
  const head = s ? TEAM[s].name : pros ? (p.dt ? `${TEAM[p.dt].nick} draft pick` : 'Draft prospect') : 'Free agent'
  return createPortal(
    <div className="ss-overlay nb-sheet-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fk fk-root nb-sheet" role="dialog" aria-label={p.n} style={fkVars(kit)}>
        <div className="nb-sheet-top"><b>{head}</b><button className="fk-x" onClick={onClose} aria-label="Close">✕</button></div>
        {/* (no second line on the card: at phone width it wraps under the position; the facts carry it) */}
        <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={kit} size="l" mine={p.b != null ? owner : null} />
        <div className="nb-facts">
          <span><small>Age</small><b>{pros ? (p.ag ?? 20) - 1 : p.ag}</b></span>
          <span><small>Height, weight</small><b>{heightText(p.ht)} · {p.wt} LBS</b></span>
          <span><small>Experience</small><b>{p.ys > 0 ? `${p.ys} ${p.ys === 1 ? 'YEAR' : 'YEARS'}` : 'ROOKIE'}</b></span>
          {/* (a real man's draft isn't in the league's data: shown for the men drafted in it) */}
          {p.dr && <span><small>Drafted</small><b>{p.dr[0]} · {p.dr[1] === 1 ? '1ST' : '2ND'} ROUND, NO. {p.dr[2]}</b></span>}
          <span><small>Contract</small><b>{pros ? 'UNSIGNED' : !s && !(p.y > 0) ? 'FREE AGENT' : dealLine(p)}</b></span>
          {!s && !pros && p.fr && TEAM[p.fr] && <span><small>Last team</small><b>{TEAM[p.fr].short}</b></span>}
          {p.c && <span><small>From</small><b>{String(p.c).toUpperCase()}</b></span>}
          {p.inj?.g > 0 && <span className="is-wide is-inj"><small>Injury</small><b>{String(p.inj.k).toUpperCase()} · {p.inj.se ? 'OUT FOR THE SEASON' : `OUT ${p.inj.g} ${p.inj.g === 1 ? 'GAME' : 'GAMES'}`}</b></span>}
        </div>
        {perGameLine(F, p) && <p className="nb-sheet-line">{seasonText(F.year)}: {perGameLine(F, p, true)}</p>}
        {mine && <MineActs F={F} act={act} p={p} onClose={onClose} />}
        <Ratings p={p} />
        {pros ? <section className="nb-sec"><h3 className="nb-sec-h">Contract</h3><p className="nb-sec-note">{p.dt ? `Drafted by the ${TEAM[p.dt].name}. His first deal is signed when the draft closes.` : `In the ${F.year + 1} draft class.`}</p></section> : <Contract F={F} p={p} />}
        <Career F={F} p={p} s={s} />
        <Honors p={p} />
      </div>
    </div>,
    document.body,
  )
}

const CATS = { guard: GUARD_CATEGORIES, big: BIG_CATEGORIES }
function Ratings({ p }) {
  if (!p.a) return null
  const cats = CATS[p.g] ?? [{ id: 'all', label: 'Ratings', types: TYPES[p.g] ?? Object.keys(p.a) }]
  return (
    <section className="nb-sec">
      <h3 className="nb-sec-h">Ratings</h3>
      <div className="nb-grades">
        {cats.map(c => (
          <div key={c.id} className="nb-grade-cat">
            <small>{c.label}</small>
            {c.types.map(k => <span key={k} className="nb-grade"><span>{BUCKET_ATTR[k]?.label ?? k}</span><b className={`is-${gradeTone(p.a[k])}`}>{valToGrade(p.a[k] ?? 0)}</b></span>)}
          </div>
        ))}
      </div>
    </section>
  )
}
const gradeTone = v => (v >= 9 ? 'a' : v >= 6 ? 'b' : v >= 3 ? 'c' : 'd')

// his deal a season at a time: the salary, an option year marked (a player's or the team's), what follows it
function Contract({ F, p }) {
  if (p.tw) return <section className="nb-sec"><h3 className="nb-sec-h">Contract</h3><p className="nb-sec-note">Two-way contract: he splits the season between the team and its G League affiliate.</p></section>
  if (!(p.y > 0) || p.$ == null) return <section className="nb-sec"><h3 className="nb-sec-h">Contract</h3><p className="nb-sec-note">{F.fa?.includes(p) ? 'Free agent.' : 'His deal is up.'}</p></section>
  const y0 = CAP_SIM.capYear ? CAP_SIM.capYear(F) : F.year
  const pay = [p.$, ...(p.sc ?? [])].slice(0, p.y)
  const total = pay.reduce((a, v) => a + (v ?? 0), 0)
  return (
    <section className="nb-sec">
      <h3 className="nb-sec-h">Contract<span>{money(total)} over {pay.length} {pay.length === 1 ? 'season' : 'seasons'}</span></h3>
      <div className="nb-deal-yrs">
        {pay.map((v, k) => {
          const y = y0 + k, opt = p.opt?.yr === y ? p.opt.k : null
          return (
            <div key={y} className={`nb-deal-yr${opt ? ' is-opt' : ''}`}>
              <span>{seasonText(y)}</span><b>{money(v)}</b>
              <em>{opt === 'P' ? 'Player option' : opt === 'T' ? 'Team option' : k === 0 && y0 === F.year && F.phase !== 'off' ? 'This season' : p.rs ? 'Rookie scale' : ''}</em>
            </div>
          )
        })}
      </div>
      <p className="nb-sec-note">{p.y === 1 ? (p.rfa ? 'Restricted free agent after the season.' : 'Unrestricted free agent after the season.') : `Free agent after the ${seasonText(y0 + pay.length - 1)} season${p.rfa ? ' (restricted)' : ''}.`}{p.ntc ? ' No-trade clause.' : ''}</p>
    </section>
  )
}

// his seasons: the ones closed (offseason.js carRow; the oldest folded into one row) and this one so far
function Career({ F, p, s }) {
  const rows = careerView(p).map(c => ({ ...c, lbl: c.y2 ? `${c.y}-${String((c.y2 + 1) % 100).padStart(2, '0')}` : seasonText(c.y), tm: c.s || `${c.y2 - c.y + 1} YRS` }))
  const x = F.ss?.[p.i]
  if (x?.gp && F.phase !== 'off') rows.push({ ...x, lbl: seasonText(F.year), tm: x.s ?? s ?? '', now: true })
  const f = (c, k) => (c.gp ? (c[k] / c.gp).toFixed(1) : '-')
  return (
    <section className="nb-sec">
      <h3 className="nb-sec-h">Career{rows.length > 0 && <span>Per game</span>}</h3>
      {!rows.length ? <p className="nb-sec-note">{p.rk === F.year || p.ys === 0 ? 'No NBA games yet.' : `His numbers here start with the ${seasonText(F.year)} season.`}</p> : (
        <div className="bx-scroll"><table className="nb-car">
          <thead><tr><th>SEASON</th><th>TM</th><th>G</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
          <tbody>{rows.map(c => <tr key={c.lbl + c.tm} className={c.now ? 'is-now' : ''}><td>{c.lbl}</td><td>{c.tm}</td><td>{c.gp}</td><td>{f(c, 'min')}</td><td>{f(c, 'pts')}</td><td>{f(c, 'reb')}</td><td>{f(c, 'ast')}</td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  )
}
const AW = {
  MVP: 'MVP', FMVP: 'Finals MVP', ROY: 'Rookie of the Year', DPOY: 'Defensive Player of the Year', '6MOY': 'Sixth Man of the Year', MIP: 'Most Improved Player',
  CLUTCH: 'Clutch Player of the Year', ALL1: 'All-NBA First Team', ALL2: 'All-NBA Second Team', ALL3: 'All-NBA Third Team', AS: 'All-Star', CHAMP: 'NBA champion',
  DEF1: 'All-Defensive First Team', DEF2: 'All-Defensive Second Team', RK1: 'All-Rookie First Team', RK2: 'All-Rookie Second Team', ECF: 'East finals MVP', WCF: 'West finals MVP',
}
function Honors({ p }) {
  const by = {}
  for (const a of p.aw ?? []) if (AW[a.k]) (by[a.k] ??= []).push(a.y)
  const keys = Object.keys(AW).filter(k => by[k])
  if (!keys.length) return null
  return (
    <section className="nb-sec">
      <h3 className="nb-sec-h">Honors</h3>
      <ul className="nb-honor-list">{keys.map(k => <li key={k}><b>{AW[k]}{by[k].length > 1 ? ` ×${by[k].length}` : ''}</b><small>{[...new Set(by[k])].map(y => seasonText(y)).join(', ')}</small></li>)}</ul>
    </section>
  )
}

// a retired man: what the league keeps of him (offseason.js retiredRow): his last team, age, seasons, career totals
// and honours. Nothing to do here.
function RetiredSheet({ F, r, owner, onClose }) {
  const [gp, pts, reb, ast] = r.t ?? [0, 0, 0, 0]
  const f = v => (gp ? (v / gp).toFixed(1) : '-')
  // (aw: '2027MVP' strings, plus the All-Star and title counts)
  const by = {}
  for (const x of r.aw ?? []) { const k = String(x).slice(4); if (AW[k]) (by[k] ??= []).push(Number(String(x).slice(0, 4))) }
  if (r.as) by.AS = Array(r.as).fill(null)
  if (r.ch) by.CHAMP = Array(r.ch).fill(null)
  const keys = Object.keys(AW).filter(k => by[k])
  const kit = r.s && TEAM[r.s] ? r.s : F.team
  return createPortal(
    <div className="ss-overlay nb-sheet-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fk fk-root nb-sheet" role="dialog" aria-label={r.n} style={fkVars(kit)}>
        <div className="nb-sheet-top"><b>Retired</b><button className="fk-x" onClick={onClose} aria-label="Close">✕</button></div>
        <LowerThird name={r.n} ovr={r.o} photo={r.b == null ? photoOf(r.n) : null} team={kit} size="l" mine={r.b != null ? owner : null} />
        <div className="nb-facts">
          <span><small>Retired at</small><b>{r.ag ?? '-'}</b></span>
          <span><small>Seasons</small><b>{r.yrs ?? '-'}</b></span>
          {r.s && TEAM[r.s] && <span><small>Last team</small><b>{TEAM[r.s].short}</b></span>}
          {r.y != null && <span><small>Last season</small><b>{seasonText(r.y)}</b></span>}
        </div>
        <section className="nb-sec">
          <h3 className="nb-sec-h">Career{gp > 0 && <span>Per game</span>}</h3>
          {gp > 0 ? (
            <div className="bx-scroll"><table className="nb-car">
              <thead><tr><th>G</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
              <tbody><tr><td>{gp}</td><td>{f(pts)}</td><td>{f(reb)}</td><td>{f(ast)}</td></tr></tbody>
            </table></div>
          ) : <p className="nb-sec-note">No NBA games on record.</p>}
          {gp > 0 && (r.yrs ?? 0) > (r.y ?? FIRST_YEAR) - FIRST_YEAR + 1 && <p className="nb-sec-note">{`His numbers here start with the ${seasonText(FIRST_YEAR)} season.`}</p>}
        </section>
        {keys.length > 0 && (
          <section className="nb-sec">
            <h3 className="nb-sec-h">Honors</h3>
            <ul className="nb-honor-list">{keys.map(k => <li key={k}><b>{AW[k]}{by[k].length > 1 ? ` ×${by[k].length}` : ''}</b>{by[k][0] != null && <small>{[...new Set(by[k])].map(y => seasonText(y)).join(', ')}</small>}</li>)}</ul>
          </section>
        )}
      </div>
    </div>,
    document.body,
  )
}

// the GM's own man: where he plays (up, down, his minutes), an extension (asked, then confirmed), waive
function MineActs({ F, act, p, onClose }) {
  const [sure, setSure] = useState(false)
  const [ext, setExt] = useState(false)
  const id = p.i
  const opts = { playoff: isPo(F) }
  const order = coachOrder(F, F.team, CAP_SIM.rotationOf, opts).filter(x => !x.tw)
  const k = order.findIndex(x => x.i === id)
  const move = d => act(X => {
    const ids = coachOrder(X, X.team, CAP_SIM.rotationOf, opts).filter(x => !x.tw).map(x => x.i)
    const j = ids.indexOf(id), to = j + d
    if (j < 0 || to < 0 || to >= ids.length) return
    ;[ids[j], ids[to]] = [ids[to], ids[j]]
    X.teams[X.team].rot = ids
  })
  const min = CAP_SIM.rotationOf(F, F.team, opts).find(x => x.i === id)?.min ?? 0
  const set = F.teams[F.team].min?.[id]
  const cost = CAP_SIM.cutCost(F, p), costS = CAP_SIM.cutCost(F, p, { stretch: true })
  const dead = cost?.total ?? cost?.$ ?? (typeof cost === 'number' ? cost : 0)
  const canStretch = costS && (costS.per ?? costS.$) != null && (costS.years ?? costS.y ?? 0) > (cost?.years ?? cost?.y ?? 0)
  const eo = CAP_SIM.extensionOk(F, F.team, p)
  const ask = eo?.ok ? CAP_SIM.extensionAsk(F, F.team, p) : null
  const yrs = ask ? Math.min(ask.y, eo.y ?? ask.y, eo.rookie ? 9 : 5 - (p.y ?? 0)) : 0
  const tot = ask ? Array.from({ length: yrs }, (_, j) => ask.$ * (1 + Math.min(ask.r ?? 0.08, 0.08) * j)).reduce((a, v) => a + v, 0) : 0
  const sign = () => {
    const r = act(X => CAP_SIM.extendMan(X, X.team, X.teams[X.team].r.find(x => x.i === id), ask))
    if (r?.ok !== false) { act(X => addNews(X, { k: 'ext', tag: 'EXTENSION', s: X.team, i: id, text: r?.text ?? `${p.n} agrees to an extension with the ${nick(X.team)}: ${yrs} years, ${money(tot)}` })); sfx('claim') } else sfx('deny')
    setExt(false)
  }
  return (
    <>
      {!p.tw && !p.inj?.g && (
        <div className="nb-sheet-acts nb-mine-rot">
          <span className="nb-mine-lbl">{k < 5 ? 'Starter' : k >= 0 ? `${ORD(k + 1)} in the rotation` : 'Rotation'}</span>
          <button type="button" disabled={k <= 0} onClick={() => { move(-1); sfx('tap') }}>Move up</button>
          <button type="button" disabled={k < 0 || k >= order.length - 1} onClick={() => { move(1); sfx('tap') }}>Move down</button>
          <span className="nb-mine-min"><small>Minutes</small><MinStep act={act} id={id} v={set ?? Math.round(min)} set={set != null} /></span>
        </div>
      )}
      {ask && !ext && <div className="nb-sheet-acts"><button type="button" onClick={() => { setExt(true); sfx('tap') }}>Offer an extension</button></div>}
      {ask && ext && (
        <div className="nb-confirm" role="group" aria-label="Extension">
          <p>{p.n} would sign a {yrs}-year extension: {money(tot)} in all, from {money(ask.$)} in {seasonText(eo.start)}{yrs > 1 ? ` rising to ${money(ask.$ * (1 + Math.min(ask.r ?? 0.08, 0.08) * (yrs - 1)))}` : ''}. It starts when his current deal ends.</p>
          <div className="nb-sheet-acts"><button type="button" className="is-go" onClick={sign}>Sign the extension</button><button type="button" onClick={() => { setExt(false); sfx('back') }}>Not now</button></div>
        </div>
      )}
      <div className="nb-sheet-acts">
        {cutBlock(F, id) ? <span className="nb-sure">{cutBlock(F, id)}</span> : !sure ? <button type="button" className="is-danger" onClick={() => setSure(true)}>Waive him</button>
          : <><span className="nb-sure">{dead > 0 ? `${money(dead)} stays on the books` : 'Waive him?'}</span><button type="button" onClick={() => setSure(false)}>Keep</button>
            <button type="button" className="is-danger" onClick={() => { act(X => { CAP_SIM.cutMan(X, X.team, id); addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived ${p.n}` }) }); sfx('deny'); onClose() }}>Waive</button>
            {canStretch && <button type="button" className="is-danger" onClick={() => { act(X => { CAP_SIM.cutMan(X, X.team, id, { stretch: true }); addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived and stretched ${p.n}` }) }); sfx('deny'); onClose() }}>Waive and stretch</button>}</>}
      </div>
    </>
  )
}

// ── Any team: its page ───────────────────────────────────────────────────────
export function TeamPage({ F, s, onBack, onMan, backLabel = 'League' }) {
  const R = records(F)
  const c = CONF_OF[s]
  const seed = confOrder(F, c, R).indexOf(s) + 1
  const opts = { playoff: isPo(F) }
  const rot = CAP_SIM.rotationOf(F, s, opts)
  const mins = Object.fromEntries(rot.map(x => [x.i, x.min]))
  const T = F.teams[s]
  const order = coachOrder(F, s, CAP_SIM.rotationOf, opts).filter(p => !p.tw)
  const hurt = T.r.filter(p => p.inj?.g && !p.tw), tw = T.r.filter(p => p.tw)
  const cap = CAP_SIM.capSheet(F, s)
  const OVER = { under: 'Under the cap', cap: 'Over the cap', tax: 'In the luxury tax', a1: 'Over the first apron', a2: 'Over the second apron' }
  const rank = SHORTS.slice().sort((a, b) => teamOvr(F, b) - teamOvr(F, a)).indexOf(s) + 1
  return (
    <div className="nb-team nb-tpage">
      <BackBar label={backLabel} title={TEAM[s].nick} onBack={onBack} />
      <TeamSlab s={s} size="m" sub={R[s].g ? `${recText(R[s])} · ${ORD(seed)} IN THE ${c === 'E' ? 'EAST' : 'WEST'}` : `${c === 'E' ? 'EASTERN' : 'WESTERN'} CONFERENCE`} />
      <div className="nb-tfacts">
        <Fact v={teamOvr(F, s)} label={`TEAM OVR · ${ORD(rank)}`} size={30} />
        <Fact v={money(cap.pay)} label={(s === F.team && F.noCap ? 'NO SALARY CAP' : OVER[cap.over] ?? '').toUpperCase()} size={30} />
      </div>
      <Chyron team={s} title="Rotation" sub={`${T.r.filter(p => !p.tw).length} STANDARD · ${tw.length} TWO-WAY`} />
      <div className="nb-rot">
        {order.map((p, k) => (
          <div key={p.i} className="nb-rot-grp">
            {(k === 0 || k === 5) && <span className="nb-rot-sh">{k === 0 ? 'Starters' : 'Bench'}</span>}
            <div className="nb-rot-row">
              <MinCell v={mins[p.i]} />
              <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={s} size="s" line={perGameLine(F, p) ?? `AGE ${p.ag} · ${dealLine(p)}`} onClick={() => { onMan(p.i); sfx('tap') }} />
            </div>
          </div>
        ))}
        {hurt.length > 0 && <span className="nb-rot-sh">Injured</span>}
        {hurt.map(p => (
          <div key={p.i} className="nb-rot-row is-out">
            <span className="nb-rot-k"><Tag tone="inj">OUT</Tag></span>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={s} size="s" line={injShort(p.inj)} onClick={() => onMan(p.i)} />
          </div>
        ))}
        {tw.length > 0 && <span className="nb-rot-sh">Two-way</span>}
        {tw.map(p => (
          <div key={p.i} className="nb-rot-row">
            <span className="nb-rot-k"><small>2-WAY</small></span>
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={s} size="s" line={`AGE ${p.ag}`} onClick={() => onMan(p.i)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// the league's teams: by division, each a row (logo, record, OVR, payroll) into its page
export function TeamsList({ F, onTeam }) {
  const R = records(F)
  return (
    <section className="nb-teams">
      {Object.values(CONF_DIVS).flat().map(d => (
        <div key={d} className="nb-stand">
          <Chyron tone="ink" size="s" title={d} />
          <div className="nb-tl-head"><span /><span>W-L</span><span>OVR</span><span>PAYROLL</span></div>
          {DIVS[d].map(s => (
            <button key={s} type="button" className={`nb-st-row nb-tl-row${s === F.team ? ' is-me' : ''}`} style={fkVars(s)} onClick={() => { onTeam(s); sfx('tap') }}>
              <span className="nb-st-t"><KLogo s={s} size={22} /><b>{TEAM[s].nick}</b></span>
              <span>{recText(R[s])}</span><span>{teamOvr(F, s)}</span><span>{money(CAP_SIM.capSheet(F, s).pay)}</span>
            </button>
          ))}
        </div>
      ))}
    </section>
  )
}

// ── The GM's schedule: the whole regular season ──────────────────────────────
// a month at a time: the date, home or away, the result (or the other team's record), the second night of a
// back-to-back marked; it opens at the next game
export function NbaSchedule({ F, onClose }) {
  const G = myGames(F)
  const R = records(F)
  const next = nextMine(F)
  const at = useRef(null)
  useEffect(() => { at.current?.scrollIntoView({ block: 'center' }) }, [])
  const months = useMemo(() => {
    const out = []
    for (const g of G) { const m = dateText(F, g.d).split(' ')[0]; if (!out.length || out[out.length - 1][0] !== m) out.push([m, []]); out[out.length - 1][1].push(g) }
    return out
  }, [F, G.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const b2b = G.filter(g => b2bOf(F, g)[g.h === F.team ? 'h' : 'a']).length
  const MON = { OCT: 'October', NOV: 'November', DEC: 'December', JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April' }
  const r = R[F.team]
  return createPortal(
    <div className="ss-overlay nb-sheet-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fk fk-root nb-sheet nb-sched" role="dialog" aria-label="Schedule" style={fkVars(F.team)}>
        <div className="nb-sheet-top"><b>{seasonText(F.year)} schedule</b><button className="fk-x" onClick={onClose} aria-label="Close">✕</button></div>
        <p className="nb-sec-note">{recText(r)} · {G.filter(g => g.hs == null).length} games left · {b2b} back-to-backs (B2B: the second night)</p>
        {months.map(([m, gs]) => (
          <section key={m} className="nb-sch-mon">
            <h3 className="nb-sec-h">{MON[m] ?? m}</h3>
            {gs.map(g => {
              const home = g.h === F.team, opp = home ? g.a : g.h
              const done = g.hs != null, us = home ? g.hs : g.as, them = home ? g.as : g.hs, won = done && us > them
              const two = b2bOf(F, g)[home ? 'h' : 'a']
              return (
                <div key={`${g.d}-${opp}`} ref={g === next ? at : null} className={`nb-sch-row${done ? (won ? ' is-w' : ' is-l') : ''}${g === next ? ' is-next' : ''}`} style={fkVars(opp)}>
                  <span className="nb-sch-d">{dateText(F, g.d)}</span>
                  <span className="nb-sch-o"><i>{home ? 'vs' : '@'}</i><KLogo s={opp} size={22} /><b>{nick(opp)}</b>{two && <em className="nb-b2b">B2B</em>}</span>
                  <span className="nb-sch-r">{done ? <><b>{won ? 'W' : 'L'}</b> {us}-{them}{g.ot ? ` ${g.ot > 1 ? `${g.ot}OT` : 'OT'}` : ''}</> : g === next ? <b>NEXT</b> : recText(R[opp])}</span>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>,
    document.body,
  )
}
