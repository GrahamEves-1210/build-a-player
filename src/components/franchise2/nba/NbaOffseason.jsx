import { useEffect, useState } from 'react'
import {
  TEAM, STEPS, STEP_NAME, nextStep, manOf, teamOfMan, AWARD_FULL, seasonText, nick, FINISH_TEXT, onClock, available, makePick, draftTo,
  rangeOf, scout, starProspect, resignMine, signFA, faNext, campCheck, CAP_SIM, ROSTER_MAX, draftOrder, addNews, teamOptions, setOption, answerSheet, minPool, signMin,
  records, recText,
} from '../../../lib/franchise2/nba'
import { manPhoto } from './NbaBuilds'
import { sfx, haptic } from '../../../lib/juice'
import { fkVars, KLogo, Chyron, LowerThird, Go, Flip, ActionBar, BackBar, Fold, reduced } from '../kit'
import { CapBar, dealText } from './NbaTeam'
import { money } from './NbaHub'
import './nbaoff.css'

// THE SUMMER, a stop at a time: awards, the lottery, the draft, re-signing, free agency, camp. A stop behind him opens
// again from its pill, read-only (what happened there), and the next stop's button is always at the bottom.
export default function NbaOffseason({ F, act, owner }) {
  const st = F.off?.step ?? 'awards'
  const at = STEPS.indexOf(st)
  const [look, setLook] = useState(null)
  useEffect(() => { setLook(null) }, [st])
  // (leaving the draft: the league ages a year as the re-sign stop opens; every man's rating before and after is the
  // summer's development report, F.off.dev)
  const go = () => {
    act(X => {
      const was = X.off?.step === 'draft' ? snapLeague(X) : null
      nextStep(X)
      if (was && X.off) X.off.dev = devOf(X, was)
    })
    sfx('whistle'); haptic('light'); toTop()
  }
  const view = look && STEPS.indexOf(look) < at ? look : null
  return (
    <div className="nb-off">
      <nav className="nbo-steps" aria-label="Offseason steps">
        {STEPS.map((k, i) => (
          <button key={k} type="button" disabled={i > at} aria-current={i === at && !view ? 'step' : undefined}
            className={(view ? k === view : i === at) ? 'is-on' : i < at ? 'is-done' : ''}
            onClick={() => { setLook(i < at ? k : null); sfx('tap'); toTop() }}>
            <span className="nbo-step-l">{STEP_NAME[k]}</span><span className="nbo-step-s">{k === 'fa' ? 'FA' : STEP_NAME[k]}</span>
          </button>
        ))}
      </nav>
      {view ? (
        <>
          <BackBar label={`Back to ${STEP_NAME[st]}`} onBack={() => { setLook(null); sfx('back'); toTop() }} />
          {view === 'awards' && <Awards F={F} done />}
          {view === 'lottery' && <Lottery F={F} done />}
          {view === 'draft' && <DraftDone F={F} />}
          {view === 'resign' && <ResignDone F={F} />}
          {view === 'fa' && <FaDone F={F} />}
        </>
      ) : (
        <>
          {st === 'awards' && <Awards F={F} act={act} go={go} />}
          {st === 'lottery' && <Lottery F={F} go={go} />}
          {st === 'draft' && <Draft F={F} act={act} go={go} />}
          {st === 'resign' && <Resign F={F} act={act} go={go} />}
          {st === 'fa' && <FreeAgency F={F} act={act} go={go} />}
          {st === 'camp' && <Camp F={F} act={act} go={go} owner={owner} />}
        </>
      )}
    </div>
  )
}

// a confirm button that can't take the tap that opened it: it arms a moment after it shows (a double tap on the first
// button never lands on the second)
function useArmed(key, ms = 500) {
  const [on, setOn] = useState(false)
  useEffect(() => { setOn(false); if (key == null) return; const t = setTimeout(() => setOn(true), ms); return () => clearTimeout(t) }, [key, ms])
  return on
}
// (the hub's scroll box, else the page)
const toTop = () => { try { const b = document.querySelector('.fh-scroll'); if (b) b.scrollTo(0, 0); else window.scrollTo(0, 0) } catch { /* (no scroll box) */ } }
const yrs = n => `${n} ${n === 1 ? 'YR' : 'YRS'}`
const htText = ht => `${Math.floor(ht / 12)}'${ht % 12}"`
const lastName = n => String(n).split(' ').filter(w => !/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w)).slice(-1)[0] ?? n
const allMen = F => [...Object.values(F.teams).flatMap(t => t.r), ...(F.fa ?? [])]

// ── Player development: the summer's rating changes ──────────────────────────
const snapLeague = F => { const m = {}; for (const p of allMen(F)) m[p.i] = p.o; return m }
function devOf(F, was) {
  const now = allMen(F)
  const seen = now.filter(p => was[p.i] != null)
  const d = x => x[2] - x[1]
  const row = p => [p.i, was[p.i], p.o]
  const mineIds = new Set(F.teams[F.team].r.map(p => p.i))
  const m = seen.filter(p => mineIds.has(p.i) || p.fr === F.team).map(row).sort((a, b) => d(b) - d(a) || b[2] - a[2])
  // (the league's: the biggest moves among men who play, the rotation-level ones)
  const up = seen.filter(p => p.o > was[p.i] && p.o >= 70).map(row).sort((a, b) => d(b) - d(a) || b[2] - a[2]).slice(0, 8)
  const dn = seen.filter(p => p.o < was[p.i] && was[p.i] >= 72).map(row).sort((a, b) => d(a) - d(b) || b[1] - a[1]).slice(0, 8)
  const live = new Set(now.map(p => p.i))
  const rt = (F.retired ?? []).filter(r => was[r.i] != null && !live.has(r.i)).sort((a, b) => (b.o ?? 0) - (a.o ?? 0)).slice(0, 12).map(r => r.i)
  return { y: F.year, m, up, dn, rt }
}
function DevRow({ F, x }) {
  const p = manOf(F, x[0]), s = p ? teamOfMan(F, p.i) ?? p.fr ?? null : null
  const ch = x[2] - x[1]
  return (
    <li style={s ? fkVars(s) : undefined}>
      {s ? <KLogo s={s} size={20} /> : <i className="nbo-nologo" />}
      <span><b>{p?.n ?? '-'}</b><small>{p ? `${p.p} · AGE ${p.ag}${s ? ` · ${TEAM[s].short}` : ''}` : ''}</small></span>
      <em className={ch > 0 ? 'is-up' : ch < 0 ? 'is-dn' : ''}>{`${x[1]} → ${x[2]}`}</em>
    </li>
  )
}
// (folded on the re-sign stop, a line saying how the roster moved; open when the stop is looked back at)
function Development({ F, open = false }) {
  const D = F.off?.dev
  if (!D) return null
  const ret = (D.rt ?? []).map(i => (F.retired ?? []).find(r => r.i === i)).filter(Boolean)
  const up = (D.m ?? []).filter(x => x[2] > x[1]).length, dn = (D.m ?? []).filter(x => x[2] < x[1]).length
  return (
    <Fold className="nbo-dev" open={open} title="Player development" right={`${nick(F.team)}: ${up} up · ${dn} down`}>
      <p className="nbo-note">{`Everyone is a year older for ${seasonText(D.y + 1)}: young men grew, veterans slipped, and ${ret.length ? 'some retired' : 'the league moved on'}.`}</p>
      <div className="nbo-dev-box">
        <b>{TEAM[F.team].nick}</b>
        <ol className="nbo-dev-list">{(D.m ?? []).map(x => <DevRow key={x[0]} F={F} x={x} />)}</ol>
      </div>
      {D.up?.length > 0 && <div className="nbo-dev-box"><b>Around the league: up</b><ol className="nbo-dev-list">{D.up.map(x => <DevRow key={x[0]} F={F} x={x} />)}</ol></div>}
      {D.dn?.length > 0 && <div className="nbo-dev-box"><b>Around the league: down</b><ol className="nbo-dev-list">{D.dn.map(x => <DevRow key={x[0]} F={F} x={x} />)}</ol></div>}
      {ret.length > 0 && (
        <div className="nbo-dev-box">
          <b>Retired</b>
          <ol className="nbo-dev-list">{ret.map(r => <li key={r.i} style={r.s ? fkVars(r.s) : undefined}>{r.s ? <KLogo s={r.s} size={20} /> : <i className="nbo-nologo" />}<span><b>{r.n}</b><small>{`AGE ${r.ag} · ${r.yrs} ${r.yrs === 1 ? 'SEASON' : 'SEASONS'}${r.t?.[0] ? ` · ${(r.t[1] / r.t[0]).toFixed(1)} PPG` : ''}`}</small></span><em>{r.o ?? ''}</em></li>)}</ol>
        </div>
      )}
    </Fold>
  )
}

// ── 1. AWARDS ────────────────────────────────────────────────────────────────
const AW_KEYS = ['MVP', 'FMVP', 'DPOY', 'ROY', '6MOY', 'MIP', 'CLUTCH']
const AW_LABEL = { ...AWARD_FULL, ECF: 'Eastern Conference Finals MVP', WCF: 'Western Conference Finals MVP' }
const per = (x, k) => (x?.gp ? (x[k] ?? 0) / x.gp : 0)
const f1 = v => v.toFixed(1)
// his line for that season: this season's from the box scores (until the new season clears them), else his career row
export function seasonOf(F, i, y) {
  if (y === F.year && F.ss?.[i]?.gp) return F.ss[i]
  return manOf(F, i)?.car?.find(c => c.y === y && !c.y2 && c.gp) ?? null
}
export function statLine(F, i, y, k) {
  if (k === 'FMVP' || k === 'ECF' || k === 'WCF') {
    // (the series itself while the bracket is still up; his whole postseason from his career row after)
    const S = y === F.year ? (k === 'FMVP' ? F.po?.all?.[3]?.[0] : (F.po?.all?.[2] ?? []).find(C => C.c === (k === 'ECF' ? 'E' : 'W'))) : null
    const x = S?.st?.[i]
    if (x?.gp) return `${f1(per(x, 'pts'))} PTS · ${f1(per(x, 'reb'))} REB · ${f1(per(x, 'ast'))} AST IN THE ${k === 'FMVP' ? 'FINALS' : 'SERIES'}`
    const po = y === F.year ? F.ps?.[i] : null
    if (po?.gp) return `${f1(per(po, 'pts'))} PTS · ${f1(per(po, 'reb'))} REB · ${f1(per(po, 'ast'))} AST IN THE PLAYOFFS`
    const c = seasonOf(F, i, y)?.po
    return c?.[0] ? `${f1(c[1] / c[0])} PTS · ${f1(c[2] / c[0])} REB · ${f1(c[3] / c[0])} AST IN THE PLAYOFFS` : ''
  }
  const x = seasonOf(F, i, y)
  if (!x?.gp) return ''
  if (k === 'DPOY' || k === 'DEF') return `${f1(per(x, 'reb'))} REB · ${f1(per(x, 'stl'))} STL · ${f1(per(x, 'blk'))} BLK`
  const base = `${f1(per(x, 'pts'))} PTS · ${f1(per(x, 'reb'))} REB · ${f1(per(x, 'ast'))} AST`
  if (k === 'CLUTCH' && x.cp) return `${base} · ${x.cp} CLUTCH PTS`
  if (k === '6MOY' && x.gs != null) return `${base} · ${x.gp - x.gs} GAMES OFF THE BENCH`
  return base
}
// the conference finals MVPs (kept on the men's awards: { y, k: 'ECF' | 'WCF' }), unless the year's record has them
export function cfMvps(F, h) {
  const out = []
  for (const k of ['ECF', 'WCF']) {
    if (h.aw?.[k]) { out.push([k, h.aw[k]]); continue }
    const p = allMen(F).find(m => (m.aw ?? []).some(a => a.y === h.y && a.k === k))
    if (p) out.push([k, { i: p.i, n: p.n, s: seasonOf(F, p.i, h.y)?.s || teamOfMan(F, p.i) || p.was || null }])
  }
  return out
}
function Awards({ F, act, go, done = false }) {
  const h = F.hist[F.hist.length - 1]
  if (!h) return null
  const A = h.aw ?? {}
  const list = [...AW_KEYS.filter(k => A[k]).map(k => [k, A[k]]), ...cfMvps(F, h)]
  return (
    <section className="nb-aw">
      <Chyron team={F.team} tag={seasonText(h.y)} title={`${nick(F.team)} ${h.w}-${h.l}`} sub={(FINISH_TEXT[h.finish] ?? '').toUpperCase()} />
      {h.champ && <p className="nbo-champ" style={fkVars(h.champ)}><KLogo s={h.champ} size={30} /><span><b>{TEAM[h.champ].name}</b><small>{`NBA CHAMPIONS${h.ru ? ` · BEAT THE ${TEAM[h.ru].nick.toUpperCase()} IN THE FINALS` : ''}`}</small></span></p>}
      <Chyron tone="ink" size="s" title="The awards" sub={seasonText(h.y)} />
      <div className="nbo-awards">
        {list.map(([k, w]) => {
          const p = manOf(F, w.i)
          const line = statLine(F, w.i, h.y, k)
          return (
            <div key={k} className={`nbo-aw${w.s === F.team ? ' is-me' : ''}`} style={w.s ? fkVars(w.s) : undefined}>
              <small className="nbo-aw-k">{AW_LABEL[k] ?? k}</small>
              <LowerThird name={w.n} pos={p?.p} num={p?.num} ovr={p?.o} photo={p ? manPhoto(F, p) : null} team={w.s} size="s" line={TEAM[w.s]?.name?.toUpperCase()} />
              {line && <p className="nbo-aw-line">{line}</p>}
            </div>
          )
        })}
      </div>
      <AwardTeams F={F} y={h.y} title="All-NBA" teams={A.ALL} names={['First team', 'Second team', 'Third team']} />
      <AwardTeams F={F} y={h.y} title="All-Defensive" teams={A.ALLDEF} names={['First team', 'Second team']} k="DEF" />
      <AwardTeams F={F} y={h.y} title="All-Rookie" teams={A.ROOKIE} names={['First team', 'Second team']} />
      {!done && <TeamOptions F={F} act={act} />}
      {!done && <ActionBar><Go onClick={go}>The draft lottery</Go></ActionBar>}
    </section>
  )
}
// an award's teams (All-NBA, All-Defensive, All-Rookie): five men a team, each with his club and his line
export function AwardTeams({ F, y, title, teams, names, k = 'ALL', me = F.team }) {
  if (!teams?.length) return null
  return (
    <section className="nbo-tl">
      <Chyron tone="ink" size="s" title={title} />
      {teams.map((t, j) => (
        <div key={j} className="nbo-tl-team">
          <b>{names[j]}</b>
          <ol>
            {t.map(x => {
              const p = manOf(F, x.i)
              return (
                <li key={x.i} className={x.s === me ? 'is-me' : ''} style={x.s ? fkVars(x.s) : undefined}>
                  {x.s ? <KLogo s={x.s} size={22} /> : <i className="nbo-nologo" />}
                  <span><b>{x.n}</b><small>{[p?.p, TEAM[x.s]?.short].filter(Boolean).join(' · ')}</small></span>
                  <em>{statLine(F, x.i, y, k)}</em>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </section>
  )
}

// ── 2. THE LOTTERY ───────────────────────────────────────────────────────────
// the odds first (the order the records gave, each team's chance at No. 1 and who owns the pick); then the drawing
// read out the way the league does it, from the last lottery spot to No. 1, slower once it reaches the drawn picks.
// It reads whatever system F.lot holds (its teams, each one's odds; L.drawn when the picks drawn aren't four).
function Lottery({ F, go, done = false }) {
  const L = F.lot
  const list = (L?.lottery ?? []).slice().reverse()
  const n = list.length
  const drawn = Math.min(n, L?.drawn ?? L?.draws ?? 4)
  const [k, setK] = useState(() => (done ? n : -1))   // -1: the odds table; then the cards turned (from the last spot)
  useEffect(() => {
    if (k < 0 || k >= n) return
    const left = n - k   // the spot the next card shows
    const t = setTimeout(() => setK(k + 1), reduced() ? 60 : k === 0 ? 700 : left === drawn ? 2600 : left < drawn ? 2000 : 800)
    return () => clearTimeout(t)
  }, [k, n, drawn])
  // (the card being turned stays on screen)
  useEffect(() => { if (k > 0 && k <= n && !done) try { document.querySelectorAll('.nbo-lot-slot')[k - 1]?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }) } catch { /* (old browsers) */ } }, [k, n, done])
  if (!L) return <p className="nb-why">The lottery hasn't been drawn.</p>
  const owner = s => (F.picks ?? []).find(p => p.y === L.y && p.r === 1 && p.o === s)?.t ?? s
  const mine = L.lottery.filter(x => owner(x.s) === F.team)
  const gave = L.lottery.find(x => x.s === F.team && owner(x.s) !== F.team)
  const over = k >= n
  const parts = mine.map(x => `${x.s !== F.team ? `${TEAM[x.s].short} PICK ` : ''}${over ? `NO. ${x.to}` : `${x.odds.toFixed(1)}% FOR NO. 1`}`)
  if (gave) parts.push(`OWN PICK TO ${TEAM[owner(F.team)].short}`)
  const sub = `${nick(F.team).toUpperCase()}: ${parts.length ? parts.join(' · ') : 'NOT IN THE LOTTERY'}`
  const R = records(F)
  const pre = L.lottery.slice().sort((a, b) => a.from - b.from)
  const ownTag = x => { const o = owner(x.s); return o === x.s ? null : o === F.team ? `YOURS, VIA ${TEAM[x.s].short}` : `OWNED BY ${TEAM[o].short}` }
  return (
    <section className="nb-lot">
      <Chyron team={F.team} title={`${L.y} Draft Lottery`} sub={sub} />
      {(k < 0 || done) && (
        <>
          <Chyron tone="ink" size="s" title="The odds" sub={`${n} TEAMS · THE TOP ${drawn} PICKS DRAWN`} />
          <ol className="nbo-odds">
            <li className="nbo-odds-h"><i>SPOT</i><span>TEAM</span><em>NO. 1</em></li>
            {pre.map(x => (
              <li key={x.s} className={owner(x.s) === F.team ? 'is-me' : ''} style={fkVars(x.s)}>
                <i>{x.from}</i>
                <span><KLogo s={x.s} size={22} /><span><b>{TEAM[x.s].nick}</b><small>{[recText(R[x.s]), ownTag(x)].filter(Boolean).join(' · ')}</small></span></span>
                <em>{`${x.odds.toFixed(1)}%`}</em>
              </li>
            ))}
          </ol>
          {!done && <ActionBar><Go onClick={() => { setK(0); sfx('whistle') }}>Open the envelopes</Go></ActionBar>}
        </>
      )}
      {k >= 0 && (
        <div className="nb-lot-list">
          {list.map((x, i) => {
            const o = owner(x.s)
            return (
              <div key={x.s} className="nbo-lot-slot">
                {n - i === drawn && i <= k && <p className="nbo-lot-top">{`THE TOP ${drawn}`}</p>}
                <Flip open={i < k} className="nb-lot-card" back={<span className="nb-lot-back">{x.to}</span>}
                  front={(
                    <span className={`nb-lot-face${o === F.team ? ' is-me' : ''}`} style={fkVars(x.s)}>
                      <i>{x.to}</i><KLogo s={x.s} size={30} />
                      <span className="nbo-lot-who"><b>{TEAM[x.s].nick}</b>{o !== x.s && <small>{`PICK OWNED BY ${TEAM[o].short}`}</small>}</span>
                      <small className="nbo-lot-move"><span>{x.to < x.from ? `UP FROM ${x.from}` : x.to > x.from ? `DOWN FROM ${x.from}` : `STAYS AT ${x.from}`}</span><span>{`${x.odds.toFixed(1)}%`}</span></small>
                    </span>
                  )} />
              </div>
            )
          })}
        </div>
      )}
      {k >= 0 && !over && <button type="button" className="fh-textbtn" onClick={() => setK(n)}>Show all</button>}
      {over && !done && <ActionBar><Go onClick={go}>Draft night</Go></ActionBar>}
    </section>
  )
}

// ── 3. THE DRAFT ─────────────────────────────────────────────────────────────
const rows = (F, ids) => ids.map(i => (F.dc ?? []).find(p => p.i === i)).filter(Boolean)
// (a prospect's age on draft night: the class keeps his rookie-season age, and the draft stores him a year younger)
export const draftAge = p => (p.ag ?? 20) - 1
function Draft({ F, act, go }) {
  const pk = onClock(F)
  const mine = pk?.t === F.team
  const made = F.dn?.made ?? []
  const [show, setShow] = useState(() => (pk ? 'board' : 'made'))
  const [sel, setSel] = useState(null)
  const [recent, setRecent] = useState([])
  const armed = useArmed(sel)
  useEffect(() => { if (!pk) setShow(v => (v === 'board' ? 'made' : v)) }, [!pk]) // eslint-disable-line react-hooks/exhaustive-deps
  const board = available(F).slice().sort((a, b) => a.rank - b.rank)
  const starred = rows(F, F.board ?? []).filter(p => !p.dt)
  const best = starred[0] ?? board[0] ?? null
  const simTo = () => { const r = act(X => draftTo(X)) ?? []; setRecent(r.filter(Boolean).map(x => x.pick.n)); setSel(null); sfx('flip'); toTop() }
  const pick = id => {
    const r = act(X => { const r = makePick(X, id); if (r) addNews(X, { k: 'draft', tag: 'DRAFT', s: X.team, text: `With the No. ${r.pick.n} pick, the ${TEAM[X.team].name} select ${r.man.n}, ${r.man.p}, ${r.man.c}` }); return r })
    if (r) setRecent([r.pick.n])
    setSel(null); sfx('claim'); haptic('medium'); toTop()
  }
  const mineLeft = draftOrder(F).slice(F.dn?.at ?? 0).filter(p => p.t === F.team)
  const selP = sel != null ? board.find(p => p.i === sel) : null
  const last = made[made.length - 1]
  const earlier = made.filter(m => recent.includes(m.n) && m !== last)
  return (
    <section className="nb-draft">
      <Chyron team={pk?.t ?? F.team} tag={pk ? `NO. ${pk.n}` : 'DONE'} title={pk ? `${TEAM[pk.t].nick} on the clock` : 'The draft is over'}
        sub={pk ? `ROUND ${pk.r}${pk.o !== pk.t ? ` · FROM ${TEAM[pk.o].short}` : ''} · ${mineLeft.length ? `${nick(F.team).toUpperCase()} PICK ${mineLeft.map(p => p.n).join(', ')}` : `${nick(F.team).toUpperCase()}: NO PICKS LEFT`}` : `${made.length} PICKS · ${made.filter(m => m.t === F.team).length} FOR THE ${nick(F.team).toUpperCase()}`} />
      {last && <PickCard F={F} m={last} />}
      {earlier.length > 0 && (
        <details className="nbo-recent">
          <summary>{`Picks ${earlier[0].n} to ${earlier[earlier.length - 1].n} before it`}</summary>
          <ol className="nb-made">{earlier.slice().reverse().map(m => <MadeRow key={m.n} F={F} m={m} />)}</ol>
        </details>
      )}
      {pk && mine && <p className="nbo-note">{`The ${nick(F.team)} are on the clock. ${(F.sp ?? 0) > 0 ? `${F.sp} scouting ${F.sp === 1 ? 'report' : 'reports'} left. ` : ''}Pick a man from the board, or take the best available: ${starred.length ? 'the top of your starred board' : 'the top of the consensus board (star men to make your own)'}.`}</p>}
      <div className="nb-by" role="tablist">
        {pk && <button type="button" role="tab" aria-selected={show === 'board'} className={show === 'board' ? 'is-on' : ''} onClick={() => setShow('board')}>Big board</button>}
        <button type="button" role="tab" aria-selected={show === 'mine'} className={show === 'mine' ? 'is-on' : ''} onClick={() => setShow('mine')}>{`Starred${starred.length ? ` (${starred.length})` : ''}`}</button>
        <button type="button" role="tab" aria-selected={show === 'made'} className={show === 'made' ? 'is-on' : ''} onClick={() => setShow('made')}>{`Picks made (${made.length})`}</button>
      </div>
      {show !== 'made' && (
        <div className="nb-board">
          {(show === 'mine' ? starred : board).slice(0, 40).map(p => <Prospect key={p.i} F={F} p={p} act={act} sel={sel === p.i} onPick={pk && mine ? () => { setSel(p.i); sfx('tap') } : null} />)}
          {show === 'mine' && !starred.length && <p className="nbo-note">Star the men you want on the Big board. Best available takes the top of your starred list, in the order you starred them.</p>}
        </div>
      )}
      {show === 'made' && <ol className="nb-made">{made.slice().reverse().map(m => <MadeRow key={m.n} F={F} m={m} />)}</ol>}
      {pk && mine && selP && (
        <ActionBar className="nbo-confirm">
          <p className="nbo-confirm-q">{`No. ${pk.n}: ${selP.n}`}<small>{`${selP.p} · AGE ${draftAge(selP)} · ${htText(selP.ht)} · ${selP.c} · OVR ${selP.o} · ${rangeOf(selP).text}`}</small></p>
          <div className="nbo-two">
            <Go ghost onClick={() => { setSel(null); sfx('back') }}>Back</Go>
            <Go disabled={!armed} onClick={() => pick(selP.i)}>{`Draft ${lastName(selP.n)}`}</Go>
          </div>
        </ActionBar>
      )}
      {pk && mine && !selP && best && <ActionBar><Go onClick={() => { setSel(best.i); sfx('tap') }}>{`Best available: ${lastName(best.n)}`}</Go></ActionBar>}
      {pk && !mine && <ActionBar><Go onClick={simTo}>{mineLeft.length ? `Sim to pick ${mineLeft[0].n}` : 'Sim the rest'}</Go></ActionBar>}
      {!pk && <ActionBar><Go onClick={go}>Re-sign your players</Go></ActionBar>}
    </section>
  )
}
// the pick as the commissioner reads it: the team, the slot, the man
function PickCard({ F, m }) {
  const p = (F.dc ?? []).find(x => x.i === m.i) ?? manOf(F, m.i)
  if (!p) return null
  const inClass = p.seen != null
  const R = inClass ? rangeOf(p) : null
  const me = m.t === F.team
  return (
    <div className={`nbo-pick${me ? ' is-me' : ''}`} style={fkVars(m.t)}>
      <div className="nbo-pick-h">
        <KLogo s={m.t} size={36} />
        <span><small>{`NO. ${m.n} · ROUND ${m.r}${m.o && m.o !== m.t ? ` · FROM ${TEAM[m.o].short}` : ''}${me ? ' · YOUR PICK' : ''}`}</small><b>{`The ${TEAM[m.t].name} select`}</b></span>
      </div>
      <div className="nbo-pick-man">
        <span><b>{p.n}</b><small>{`${p.p} · AGE ${inClass ? draftAge(p) : p.ag} · ${htText(p.ht)} · ${p.c ?? ''}`}</small></span>
        <span className="nbo-pick-gr">{R && <b>{R.text}</b>}<small>{`OVR ${p.o}`}</small></span>
      </div>
    </div>
  )
}
function MadeRow({ F, m }) {
  const p = (F.dc ?? []).find(x => x.i === m.i) ?? manOf(F, m.i)
  return (
    <li className={m.t === F.team ? 'is-me' : ''} style={fkVars(m.t)}>
      <i>{m.n}</i><KLogo s={m.t} size={22} />
      <b>{p?.n ?? m.n2}</b>
      <small>{[TEAM[m.t].short, m.o && m.o !== m.t ? `VIA ${TEAM[m.o].short}` : null, p?.p, p?.c].filter(Boolean).join(' · ')}</small>
      {p && <span className="nbo-made-o">{p.o}</span>}
    </li>
  )
}
export function Prospect({ F, p, act, onPick, sel = false }) {
  const R = rangeOf(p)
  const star = (F.board ?? []).includes(p.i)
  // (scouting is for the class still to be picked: not once the draft is over)
  const step = F.phase === 'off' ? F.off?.step : null
  const canScout = !p.dt && (!step || step === 'awards' || step === 'lottery' || (step === 'draft' && !!onClock(F)))
  return (
    <div className={`nb-pros${sel ? ' is-sel' : ''}`}>
      <span className="nb-pros-rk">{p.rank}</span>
      <span className="nb-pros-txt"><b>{p.n}</b><small>{p.p} · {draftAge(p)} · {htText(p.ht)} · {p.c}</small></span>
      <span className="nb-pros-gr"><b>{R.text}</b><small>{`${p.sc >= 2 ? p.tg : p.sc === 1 ? 'SCOUTED' : 'CEILING'} · OVR ${p.o}`}</small></span>
      <span className="nb-pros-acts">
        <button type="button" aria-pressed={star} className={star ? 'is-on' : ''} onClick={() => { act(X => { starProspect(X, p.i) }); sfx('tap') }} aria-label="Star">★</button>
        {canScout && p.sc < 2 && (F.sp ?? 0) > 0 && <button type="button" onClick={() => { act(X => { scout(X, p.i) }); sfx('flip') }}>Scout</button>}
        {onPick && <button type="button" className="is-go" onClick={onPick}>{sel ? 'Picked' : 'Pick'}</button>}
      </span>
    </div>
  )
}
function DraftDone({ F }) {
  const y = F.year + 1
  const made = F.drafts?.[y] ?? F.dn?.made ?? []
  const mine = made.filter(m => m.t === F.team)
  return (
    <section className="nb-draft">
      <Chyron team={F.team} tag={y} title="The draft" sub={`${made.length} PICKS · ${mine.length} FOR THE ${nick(F.team).toUpperCase()}`} />
      {mine.map(m => <PickCard key={m.n} F={F} m={m} />)}
      <ol className="nb-made">{made.map(m => <MadeRow key={m.n} F={F} m={m} />)}</ol>
    </section>
  )
}

// ── 4. RE-SIGN ───────────────────────────────────────────────────────────────
const RIGHTS = { bird: 'Bird rights', ebird: 'Early Bird rights', nbird: 'Non-Bird rights' }
const rightsOf = p => (!p.fr || p.rn ? null : (p.bird ?? 0) >= 3 ? 'bird' : p.bird === 2 ? 'ebird' : 'nbird')
const RIGHTS_SAYS = { bird: 'he can be paid over the cap, up to his max', ebird: 'he can be paid over the cap, up to 175% of his last salary', nbird: 'he can be paid over the cap, up to 120% of his last salary' }
function Resign({ F, act, go }) {
  const ids = F.off?.mine ?? []
  const [why, setWhy] = useState(null)
  const men = ids.map(i => (F.fa ?? []).find(p => p.i === i)).filter(Boolean)
  const sheet = CAP_SIM.capSheet(F, F.team)
  const holdOf = p => sheet.holds?.find(h => h.i === p.i)?.$ ?? 0
  const kept = (F.off?.kept ?? []).map(i => F.teams[F.team].r.find(p => p.i === i)).filter(Boolean)
  const free = !!F.noCap
  // (the room a renounced hold opens: how far under the cap the payroll comes without it)
  const roomIf = off => (free ? 0 : Math.max(0, sheet.cap - (sheet.pay - off)) - sheet.room)
  const ufa = men.filter(p => !p.rfa)
  const allHolds = ufa.reduce((a, p) => a + holdOf(p), 0)
  return (
    <section className="nb-resign">
      <Development F={F} />
      <CapBar F={F} />
      <Chyron team={F.team} title="Re-sign" sub={men.length ? `${men.length} ${men.length === 1 ? 'FREE AGENT' : 'FREE AGENTS'} OF YOUR OWN` : 'NOBODY LEFT TO DECIDE ON'} />
      {men.length > 0 && (
        <p className="nbo-note">
          {'Keep a man and he signs at his ask. Let one go and his rights are renounced: his cap hold comes off your books. Anyone still undecided when free agency opens is renounced too, except a restricted free agent: his qualifying offer stands, and you can match any offer sheet he signs.'}
          {!free && allHolds > 0.05 && ` Renouncing every unrestricted man here clears ${money(allHolds)} in holds${roomIf(allHolds) > 0.05 ? ` (${money(sheet.room + roomIf(allHolds))} in cap room)` : '; you would still be over the cap'}.`}
        </p>
      )}
      {men.map(p => {
        const d = CAP_SIM.resignOffer(F, p)
        const rt = rightsOf(p)
        const hold = holdOf(p)
        const gain = roomIf(hold)
        const c = d ? CAP_SIM.canSign(F, F.team, p, { ...d, bird: true }) : null
        const x = seasonOf(F, p.i, F.year)
        return (
          <div key={p.i} className="nbo-rs">
            <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={`AGE ${p.ag}${x ? ` · ${f1(per(x, 'pts'))} PPG` : ''}`} />
            <div className="nbo-rs-facts">
              <span><small>Asks</small><b>{d ? `${money(d.$)} × ${yrs(d.y)}` : 'To test the market'}</b></span>
              <span><small>Rights</small><b>{rt ? RIGHTS[rt] : 'None'}</b></span>
              <span><small>Cap hold</small><b>{free ? 'No cap' : money(hold)}</b></span>
              <span><small>Status</small><b>{p.rfa ? `Restricted · QO ${money(p.qo)}` : 'Unrestricted'}</b></span>
            </div>
            <ul className="nbo-rs-if">
              <li><b>Keep:</b> {d ? (c?.ok ? `${money(d.$)} a season for ${d.y} ${d.y === 1 ? 'year' : 'years'}${rt ? `; with ${RIGHTS[rt]} ${RIGHTS_SAYS[rt]}` : ''}.` : `not possible: ${c?.why ?? 'no deal'}.`) : 'he wants to see what the market offers.'}</li>
              <li><b>Let go:</b> {`renounced${p.rfa ? ', he becomes an unrestricted free agent' : ''}.${free ? '' : ` His ${money(hold)} hold comes off the books${gain > 0.05 ? `: ${money(gain)} more cap room` : '; still over the cap'}.`}`}</li>
              {p.rfa && <li><b>Do nothing:</b> {`restricted free agency. Another team can sign him to an offer sheet and you get the day to match it; if nobody does, he signs his ${money(p.qo)} qualifying offer for one season.`}</li>}
            </ul>
            <span className="nb-fa-acts">
              <button type="button" className="is-go" disabled={!d || c?.ok === false} onClick={() => { const r = act(X => resignMine(X, p.i, true)); setWhy(r?.ok ? null : r?.why ?? null); sfx(r?.ok ? 'claim' : 'deny') }}>{d ? `Keep: ${money(d.$)} × ${d.y}` : 'Keep'}</button>
              <button type="button" onClick={() => { act(X => { resignMine(X, p.i, false) }); sfx('tap') }}>Let go</button>
            </span>
          </div>
        )
      })}
      {why && <p className="nb-why">{why}</p>}
      {kept.length > 0 && <KeptList F={F} kept={kept} title="Re-signed" />}
      <ActionBar><Go onClick={go}>Free agency</Go></ActionBar>
    </section>
  )
}
function KeptList({ F, kept, title }) {
  return (
    <div className="nbo-dev-box">
      <b>{title}</b>
      <ol className="nbo-dev-list">{kept.map(p => <li key={p.i} style={fkVars(F.team)}><KLogo s={F.team} size={20} /><span><b>{p.n}</b><small>{`${p.p} · AGE ${p.ag} · OVR ${p.o}`}</small></span><em>{p.y ? `${money(p.$)} × ${p.y}` : ''}</em></li>)}</ol>
    </div>
  )
}
function ResignDone({ F }) {
  const kept = (F.off?.kept ?? []).map(i => manOf(F, i)).filter(Boolean)
  return (
    <section className="nb-resign">
      <Development F={F} open />
      <Chyron team={F.team} title="Re-sign" sub={`${kept.length} RE-SIGNED`} />
      {kept.length > 0 ? <KeptList F={F} kept={kept} title="Re-signed" /> : <p className="nbo-note">Nobody was re-signed this summer.</p>}
    </section>
  )
}

// ── 5. FREE AGENCY ───────────────────────────────────────────────────────────
// the market as a list he can sort through on a phone: by spot, and by whether he can fit the man; a row opens his
// offer. With the cap engine's offers (offerSheet: an offer, or an offer sheet to a restricted man, that he answers
// when the next day opens) the GM bids; once the days are done (or without that call) he signs a man at his ask.
const VIA = { room: 'cap room', rmle: 'the room mid-level', mle: 'the mid-level exception', tmle: 'the taxpayer mid-level', bae: 'the bi-annual exception', min: 'a minimum deal', bird: 'Bird rights', ebird: 'Early Bird rights', nbird: 'Non-Bird rights', rookie: 'the rookie scale', tw: 'a two-way deal' }
const SPOTS = ['PG', 'SG', 'SF', 'PF', 'C']
const faDays = () => CAP_SIM.FA_DAYS ?? 6
const faDayNow = F => Math.max(F.off?.day ?? 0, CAP_SIM.faDayOf ? CAP_SIM.faDayOf(F) ?? 0 : 0)
const bidsOn = F => typeof CAP_SIM.offerSheet === 'function' && faDayNow(F) < faDays()
const pendOf = (F, id) => F.fao?.[id] ?? null
// the next day of free agency, and what happened in it: every man who signed (the wire: F.off.wire [day, id, team,
// $, years]) and what became of the GM's offers (F.off.fres [id, team or null])
function nextDay(X) {
  const before = new Set((X.fa ?? []).map(p => p.i))
  const offers = Object.keys(X.fao ?? {}).map(Number)
  faNext(X)
  const d = X.off.day
  const left = new Set((X.fa ?? []).map(p => p.i))
  const signed = [...before].filter(i => !left.has(i)).map(i => { const p = manOf(X, i); return [d, i, teamOfMan(X, i), p?.$ ?? 0, p?.y ?? 0] }).filter(x => x[2])
  X.off.wire = [...(X.off.wire ?? []), ...signed]
  X.off.fres = offers.map(i => [i, left.has(i) ? null : teamOfMan(X, i)])
}
function FreeAgency({ F, act, go }) {
  const [why, setWhy] = useState(null)
  const [open, setOpen] = useState(null)
  const [spot, setSpot] = useState('all')
  const [fits, setFits] = useState(true)
  const [news, setNews] = useState(null)   // the last move: { k: 'sign' | 'offer' | 'pull', id, d }
  const days = faDays()
  const day = faDayNow(F)
  const bids = bidsOn(F)
  const T = F.teams[F.team]
  const std = T.r.filter(p => !p.tw).length
  const sheets = (F.rfq ?? []).map(q => ({ q, p: (F.fa ?? []).find(x => x.i === q.i) })).filter(x => x.p)
  const all = (F.fa ?? []).slice().sort((a, b) => b.o - a.o)
  const fitOf = p => { const d = CAP_SIM.askOf(F, p); return { d, c: CAP_SIM.canSign(F, F.team, p, d) } }
  const atSpot = all.filter(p => spot === 'all' || p.p === spot)
  const nAll = atSpot.length
  // (the best 150 at the spot are checked against the cap: the rest of the street only fits at the minimum)
  const pool = atSpot.slice(0, 150).map(p => ({ p, ...fitOf(p) }))
  const shown = (fits ? pool.filter(x => x.c.ok || pendOf(F, x.p.i)) : pool).slice(0, 40)
  const nFit = pool.filter(x => x.c.ok).length
  const pend = Object.keys(F.fao ?? {}).length
  const sign = p => {
    const r = act(X => { const r = signFA(X, p.i); if (r?.ok && !r.pending) { const q = manOf(X, p.i); X.off.wire = [...(X.off.wire ?? []), [faDayNow(X), p.i, X.team, q?.$ ?? 0, q?.y ?? 0]] } return r })
    if (r?.ok) { setNews({ k: r.pending ? 'offer' : 'sign', id: p.i, d: r.deal }); setOpen(null); setWhy(null); sfx('claim'); haptic('success') } else { setWhy(r?.why ?? 'He can’t sign with you'); sfx('deny') }
  }
  const offer = (p, d) => {
    const r = act(X => CAP_SIM.offerSheet(X, (X.fa ?? []).find(x => x.i === p.i) ?? p, d))
    if (r?.ok) { setNews({ k: 'offer', id: p.i, d }); setOpen(null); setWhy(null); sfx('claim'); haptic('light') } else { setWhy(r?.why ?? 'That offer can’t be made'); sfx('deny') }
  }
  const pull = p => { act(X => { if (CAP_SIM.pullOffer) CAP_SIM.pullOffer(X, p.i); else if (X.fao?.[p.i]) { const n = { ...X.fao }; delete n[p.i]; X.fao = n } }); setNews({ k: 'pull', id: p.i }); setOpen(null); sfx('tap') }
  const next = () => { act(X => nextDay(X)); setNews(null); setOpen(null); setWhy(null); sfx('flip'); toTop() }
  const nm = id => manOf(F, id)?.n ?? ''
  return (
    <section className="nb-fa">
      <CapBar F={F} />
      <Chyron team={F.team} tag={day >= days ? 'LATE' : `DAY ${day + 1} OF ${days}`} title="Free agency"
        sub={`${(F.fa ?? []).length} ON THE MARKET · ${std} UNDER CONTRACT${std > ROSTER_MAX ? ` · CUT TO ${ROSTER_MAX} AT CAMP` : ''}`} />
      <p className="nbo-note">{day >= days ? `The ${days} days of free agency are done. The men still out there sign on the spot, at their ask.` : bids ? `Make your offers. Each man answers when day ${day + 1} is played, taking the best offer he has: another team can beat yours.` : `Day ${day + 1} of ${days}. A man signs at his ask.`}</p>
      {news && (
        <div className={`nbo-done${news.k === 'pull' ? ' is-quiet' : ''}`} style={fkVars(F.team)} role="status">
          <b>{news.k === 'sign' ? 'SIGNED' : news.k === 'offer' ? 'OFFER IN' : 'OFFER PULLED'}</b>
          <span>{news.k === 'sign' ? `${nm(news.id)} agrees to ${news.d ? `${news.d.y} ${news.d.y === 1 ? 'year' : 'years'}, ${money(news.d.$ * news.d.y)}` : 'a deal'} with the ${nick(F.team)}.` : news.k === 'offer' ? `${nm(news.id)}: ${news.d ? `${money(news.d.$)} a season for ${news.d.y} ${news.d.y === 1 ? 'year' : 'years'}. ` : ''}He answers when day ${day + 1} is played.` : `${nm(news.id)}: your offer is off the table.`}</span>
        </div>
      )}
      {(F.off?.fres ?? []).length > 0 && (
        <div className="nbo-dev-box">
          <b>{`Your offers on day ${day}`}</b>
          <ol className="nbo-dev-list">{F.off.fres.map(([i, s]) => { const p = manOf(F, i); return <li key={i} style={s ? fkVars(s) : undefined}>{s ? <KLogo s={s} size={20} /> : <i className="nbo-nologo" />}<span><b>{p?.n ?? '-'}</b><small>{s === F.team ? 'SIGNED WITH YOU' : s ? `CHOSE THE ${TEAM[s].nick.toUpperCase()}` : 'STILL DECIDING · YOUR OFFER STANDS'}</small></span><em>{s && p?.y ? `${money(p.$)} × ${p.y}` : ''}</em></li> })}</ol>
        </div>
      )}
      {sheets.map(({ q, p }) => (
        <div key={p.i} className="nb-counter">
          <p>{`${p.n} has signed an offer sheet with the ${TEAM[q.s].name}: ${q.d.y} ${q.d.y === 1 ? 'year' : 'years'}, ${money(q.d.$)} a season. Match it and he stays on those terms; let it go and he joins them.`}</p>
          <span className="nb-fa-acts"><button type="button" className="is-go" onClick={() => { act(X => { answerSheet(X, p.i, true) }); sfx('claim') }}>Match</button><button type="button" onClick={() => { act(X => { answerSheet(X, p.i, false) }); sfx('tap') }}>Let him go</button></span>
        </div>
      ))}
      <Wire F={F} />
      <div className="nbo-filter">
        <div className="nb-by" role="group" aria-label="Position">
          {['all', ...SPOTS].map(k => <button key={k} type="button" aria-pressed={spot === k} className={spot === k ? 'is-on' : ''} onClick={() => { setSpot(k); sfx('tap') }}>{k === 'all' ? 'All' : k}</button>)}
        </div>
        <div className="nb-by nbo-fits" role="group" aria-label="Who">
          <button type="button" aria-pressed={fits} className={fits ? 'is-on' : ''} onClick={() => { setFits(true); sfx('tap') }}>{`Fits your cap (${nFit})`}</button>
          <button type="button" aria-pressed={!fits} className={!fits ? 'is-on' : ''} onClick={() => { setFits(false); sfx('tap') }}>{`Everyone (${nAll})`}</button>
        </div>
      </div>
      <div className="nbo-fa-list">
        {shown.map(({ p, d, c }) => <FaRow key={p.i} F={F} p={p} d={d} c={c} open={open === p.i} onOpen={() => { setOpen(o => (o === p.i ? null : p.i)); setWhy(null); sfx('tap') }} bids={bids} onSign={sign} onOffer={offer} onPull={pull} />)}
        {!shown.length && <p className="nbo-note">{fits ? 'Nobody on the market fits under your cap or your exceptions now. Tap the filter to see everyone, or look at the minimum deals below.' : 'Nobody left at this spot.'}</p>}
      </div>
      {why && <p className="nb-why">{why}</p>}
      <MinDeals F={F} act={act} />
      <ActionBar>
        {day < days && <Go onClick={next}>{`Play day ${day + 1} of ${days}`}</Go>}
        <Go ghost={day < days} onClick={go}>Training camp</Go>
      </ActionBar>
    </section>
  )
}
function FaRow({ F, p, d, c, open, onOpen, bids, onSign, onOffer, onPull }) {
  const was = p.was ?? p.fr ?? null
  const pend = pendOf(F, p.i)
  const rfa = !!(p.rfa && p.fr && p.fr !== F.team && !p.rn)
  return (
    <div className={`nbo-fa${open ? ' is-open' : ''}${pend ? ' is-pend' : ''}${c.ok ? '' : ' is-out'}`} style={was && TEAM[was] ? fkVars(was) : undefined}>
      <button type="button" className="nbo-fa-row" aria-expanded={open} onClick={onOpen}>
        <span className="nbo-ovr">{p.o}</span>
        <span className="nbo-fa-who">
          <b>{p.n}</b>
          <small><span>{`${p.p} · AGE ${p.ag} · ${was && TEAM[was] ? TEAM[was].short : 'NO TEAM'}`}</span>{rfa && <em className="nbo-rfa">RFA</em>}{pend && <em className="nbo-pend">OFFER IN</em>}</small>
        </span>
        <span className="nbo-fa-ask"><b>{money(d.$)}</b><small>{c.ok ? yrs(d.y) : 'NO FIT'}</small></span>
      </button>
      {open && <OfferPanel F={F} p={p} ask={d} c={c} bids={bids} pend={pend} rfa={rfa} onSign={onSign} onOffer={onOffer} onPull={onPull} />}
    </div>
  )
}
function OfferPanel({ F, p, ask, c, bids, pend, rfa, onSign, onOffer, onPull }) {
  const year = CAP_SIM.capYear ? CAP_SIM.capYear(F) : F.year + 1
  const mn = CAP_SIM.minOf(p.ys ?? 0, year), mx = CAP_SIM.maxOf(p.ys ?? 0, year)
  const [amt, setAmt] = useState(pend?.$ ?? ask.$)
  const [y, setY] = useState(pend?.y ?? ask.y)
  const deal = { $: Math.round(amt * 10) / 10, y, r: ask.r ?? 0 }
  const cc = bids ? CAP_SIM.canSign(F, F.team, p, deal) : c
  const step = amt >= 20 ? 1 : 0.5
  const under = deal.$ < ask.$ - 0.05
  const was = p.was ?? p.fr
  return (
    <div className="nbo-offer">
      <p>{`He is asking ${money(ask.$)} a season for ${ask.y} ${ask.y === 1 ? 'year' : 'years'}, ${money(ask.$ * ask.y)} in all.${was && TEAM[was] ? ` Last season with the ${TEAM[was].nick}${p.$l ? ` at ${money(p.$l)}` : ''}.` : ''}`}</p>
      {rfa && <p>{`Restricted: an offer to him is an offer sheet. The ${TEAM[p.fr].nick} get a day to match it and keep him on your terms.`}</p>}
      {bids && (
        <div className="nbo-steppers">
          <span className="nbo-stp"><small>A season</small><button type="button" aria-label="Less" disabled={amt - step < mn - 0.01} onClick={() => setAmt(v => Math.max(mn, Math.round((v - step) * 10) / 10))}>−</button><b>{money(deal.$)}</b><button type="button" aria-label="More" disabled={amt + step > mx + 0.01} onClick={() => setAmt(v => Math.min(mx, Math.round((v + step) * 10) / 10))}>+</button></span>
          <span className="nbo-stp"><small>Years</small><button type="button" aria-label="Fewer years" disabled={y <= 1} onClick={() => setY(v => v - 1)}>−</button><b>{y}</b><button type="button" aria-label="More years" disabled={y >= 4} onClick={() => setY(v => v + 1)}>+</button></span>
        </div>
      )}
      <p className={cc.ok ? 'nbo-fitok' : 'nbo-fitno'}>{cc.ok ? `Fits: ${VIA[cc.via] ?? 'yes'}.` : `${String(cc.why ?? 'It doesn’t fit').replace(/\.$/, '')}.`}{bids && under && cc.ok ? ' Under his ask: he takes it only if nothing better comes.' : ''}</p>
      <span className="nb-fa-acts">
        {bids ? <button type="button" className="is-go" disabled={!cc.ok} onClick={() => onOffer(p, deal)}>{pend ? 'Change the offer' : 'Make the offer'}</button>
          : <button type="button" className="is-go" disabled={!c.ok} onClick={() => onSign(p)}>{`Sign him: ${money(ask.$)} × ${ask.y}`}</button>}
        {pend && <button type="button" onClick={() => onPull(p)}>Pull the offer</button>}
      </span>
    </div>
  )
}
// around the league: who signed where, day by day (the GM's own first)
function Wire({ F, all = false }) {
  const W = F.off?.wire ?? []
  const days = [...new Set(W.map(x => x[0]))].sort((a, b) => b - a)
  const [d, setD] = useState(null)
  const [more, setMore] = useState(false)
  if (!W.length) return null
  const on = d != null && days.includes(d) ? d : days[0]
  const list = W.filter(x => x[0] === on).map(x => ({ x, p: manOf(F, x[1]) })).filter(r => r.p && TEAM[r.x[2]]).sort((a, b) => (b.x[2] === F.team) - (a.x[2] === F.team) || b.p.o - a.p.o)
  const cut = all || more ? list : list.slice(0, 8)
  return (
    <section className="nbo-wire">
      <Chyron tone="ink" size="s" title="Around the league" sub={`${list.length} ${list.length === 1 ? 'SIGNING' : 'SIGNINGS'} ON ${on === 0 ? 'THE OPENING' : `DAY ${on}`}`} />
      {days.length > 1 && <div className="nb-by">{days.map(k => <button key={k} type="button" className={k === on ? 'is-on' : ''} onClick={() => { setD(k); setMore(false); sfx('tap') }}>{k === 0 ? 'Opening' : `Day ${k}`}</button>)}</div>}
      <ol className="nbo-dev-list">
        {cut.map(({ x, p }) => <li key={x[1]} className={x[2] === F.team ? 'is-me' : ''} style={fkVars(x[2])}><KLogo s={x[2]} size={20} /><span><b>{p.n}</b><small>{`${TEAM[x[2]].short} · ${p.p} · OVR ${p.o}${p.was && p.was !== x[2] && TEAM[p.was] ? ` · FROM ${TEAM[p.was].short}` : ''}`}</small></span><em>{x[4] ? `${money(x[3])} × ${x[4]}` : ''}</em></li>)}
      </ol>
      {!all && list.length > 8 && <button type="button" className="fh-textbtn" onClick={() => setMore(v => !v)}>{more ? 'Show fewer' : `Show all ${list.length}`}</button>}
    </section>
  )
}
function FaDone({ F }) {
  const mine = (F.off?.wire ?? []).filter(x => x[2] === F.team).map(x => manOf(F, x[1])).filter(Boolean)
  return (
    <section className="nb-fa">
      <Chyron team={F.team} title="Free agency" sub={`${mine.length} ${mine.length === 1 ? 'SIGNING' : 'SIGNINGS'} FOR THE ${nick(F.team).toUpperCase()}`} />
      {mine.length > 0 && <KeptList F={F} kept={mine} title="Signed" />}
      <Wire F={F} all />
      {!(F.off?.wire ?? []).length && <p className="nbo-note">No signings were logged this summer.</p>}
    </section>
  )
}

// ── 6. TRAINING CAMP ─────────────────────────────────────────────────────────
// the roster down to 15 standard and 3 two-way deals. Waive on a man selects him: what it costs (his dead money, or
// stretched) and the buttons show in the bar at the foot of the screen, and they arm a moment later.
function Camp({ F, act, go, owner }) {
  const t = F.teams[F.team]
  const chk = campCheck(F)
  const std = t.r.filter(p => !p.tw).sort((a, b) => b.o - a.o)
  const tw = t.r.filter(p => p.tw)
  const [sel, setSel] = useState(null)
  const armed = useArmed(sel, 600)
  const man = sel != null ? t.r.find(p => p.i === sel) : null
  const cost = man ? CAP_SIM.cutCost(F, man) : null
  const costS = man ? CAP_SIM.cutCost(F, man, { stretch: true }) : null
  const dead = cost?.total ?? 0
  const canStretch = !!(costS?.stretch && (costS.years ?? 0) > (cost?.years ?? 0) && dead > 0)
  const cut = stretch => {
    if (!man) return
    const p = man
    act(X => { CAP_SIM.cutMan(X, X.team, p.i, { stretch }); addNews(X, { k: 'cut', tag: 'WAIVED', s: X.team, text: `The ${nick(X.team)} have waived ${stretch ? 'and stretched ' : ''}${p.n}` }) })
    setSel(null); sfx('deny'); haptic('medium')
  }
  const over = std.length - ROSTER_MAX
  return (
    <section className="nb-camp">
      <Chyron team={F.team} title="Training camp" sub={`${std.length} STANDARD · ${tw.length} TWO-WAY · ${ROSTER_MAX} AND 3 ON OPENING NIGHT`} />
      <CapBar F={F} />
      {!chk.ok && <p className="nb-why">{over > 0 ? `${std.length} standard contracts: waive ${over} ${over === 1 ? 'man' : 'men'} to get to ${ROSTER_MAX}.` : chk.why}</p>}
      {std.length < 14 && <MinDeals F={F} act={act} open />}
      <div className="nbo-camp-list">
        {std.map(p => {
          const c = CAP_SIM.cutCost(F, p)
          return (
            <div key={p.i} className={`nbo-camp${sel === p.i ? ' is-sel' : ''}`}>
              <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" mine={p.b != null ? owner : null} line={`AGE ${p.ag}${p.rk === F.year + 1 ? ' · ROOKIE' : ''}`} />
              <div className="nbo-camp-cost">
                <span><span>{dealText(p)}</span><b className={c?.total > 0 ? 'is-dead' : ''}>{c?.total > 0 ? `${money(c.total)} DEAD IF WAIVED` : 'NO DEAD MONEY'}</b></span>
                <button type="button" className={sel === p.i ? 'is-on' : ''} aria-pressed={sel === p.i} onClick={() => { setSel(s => (s === p.i ? null : p.i)); sfx('tap') }}>{sel === p.i ? 'Selected' : 'Waive'}</button>
              </div>
            </div>
          )
        })}
      </div>
      {tw.length > 0 && <Chyron tone="ink" size="s" title="Two-way" sub={`${tw.length} OF 3`} />}
      {tw.map(p => <LowerThird key={p.i} name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={`AGE ${p.ag} · TWO-WAY`} />)}
      {man ? (
        <ActionBar className="nbo-confirm">
          <p className="nbo-confirm-q">{`Waive ${man.n}?`}<small>{dead > 0 ? (cost.years > 1 ? `Dead money: ${money(cost.now ?? dead)} this season, ${money(dead)} over ${cost.years} seasons` : `Dead money: ${money(dead)}, this season`) : 'No dead money: nothing left on his deal is guaranteed'}{canStretch ? `. Stretched: ${money(costS.now)} a season for ${costS.years} seasons` : ''}</small></p>
          <div className={`nbo-two${canStretch ? ' is-three' : ''}`}>
            <Go ghost onClick={() => { setSel(null); sfx('back') }}>Keep</Go>
            <Go disabled={!armed} onClick={() => cut(false)}>Waive</Go>
            {canStretch && <Go disabled={!armed} onClick={() => cut(true)}>Stretch</Go>}
          </div>
        </ActionBar>
      ) : (
        <ActionBar><Go disabled={!chk.ok} onClick={go} sub={!chk.ok && over > 0 ? `WAIVE ${over} MORE FIRST` : null}>{`Start the ${seasonText(F.year + 1)} season`}</Go></ActionBar>
      )}
    </section>
  )
}

// team options on next season: the GM picks each up or declines it (any he leaves, the front office decides)
function TeamOptions({ F, act }) {
  const due = teamOptions(F)
  if (!due.length) return null
  return (
    <>
      <Chyron tone="ink" size="s" title="Team options" sub={`${F.year + 1}-${String((F.year + 2) % 100).padStart(2, '0')} SEASON`} />
      {due.map(({ p }) => (
        <div key={p.i} className="nb-fa-row">
          <LowerThird name={p.n} pos={p.p} num={p.num} ovr={p.o} photo={manPhoto(F, p)} team={F.team} size="s" line={`AGE ${p.ag} · ${money(p.sc?.[0] ?? p.$)}${p.optd === 1 ? ' · PICKED UP' : p.optd === 0 ? ' · DECLINED' : ''}`} />
          <span className="nb-fa-acts">
            <button type="button" className={p.optd === 1 ? 'is-go' : ''} onClick={() => { act(X => { setOption(X, p.i, true) }); sfx('tap') }}>Pick it up</button>
            <button type="button" className={p.optd === 0 ? 'is-go' : ''} onClick={() => { act(X => { setOption(X, p.i, false) }); sfx('tap') }}>Decline</button>
          </span>
        </div>
      ))}
    </>
  )
}

// the minimum deals: the end of the bench, open to any team (camp lists them while the roster is short of 14)
function MinDeals({ F, act, open = false }) {
  const [why, setWhy] = useState(null)
  const [done, setDone] = useState(null)
  const men = minPool(F)
  if (!men.length && !done) return null
  return (
    <section className="nbo-min">
      <Chyron tone="ink" size="s" title="Minimum deals" sub={open ? `${F.teams[F.team].r.filter(p => !p.tw).length} OF 14 SIGNED: FILL THE ROSTER` : 'VETERANS WHO TAKE THE MINIMUM · THEY SIGN ON THE SPOT'} />
      {done && <div className="nbo-done" style={fkVars(F.team)} role="status"><b>SIGNED</b><span>{`${done} signs a one-year minimum deal.`}</span></div>}
      {men.map(p => (
        <div key={p.i} className="nbo-minrow">
          <span className="nbo-ovr">{p.o}</span>
          <span className="nbo-fa-who"><b>{p.n}</b><small><span>{`${p.p} · AGE ${p.ag} · ${p.ys ?? 0} YRS IN THE LEAGUE${p.was && TEAM[p.was] ? ` · ${TEAM[p.was].short}` : ''}`}</span></small></span>
          <button type="button" onClick={() => { const r = act(X => signMin(X, p.i)); setWhy(r?.ok ? null : r?.why ?? null); if (r?.ok) setDone(p.n); sfx(r?.ok ? 'claim' : 'deny') }}>Sign</button>
        </div>
      ))}
      {why && <p className="nb-why">{why}</p>}
    </section>
  )
}
