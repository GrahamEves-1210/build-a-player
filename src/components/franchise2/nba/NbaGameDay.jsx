import { useEffect, useMemo, useRef, useState } from 'react'
import { TEAM, nick, manOf, dateText, ROUND_NAME, seriesText } from '../../../lib/franchise2/nba'
import { eventsOf, logOf } from '../../../lib/franchise2/nba/game'
import { cbSafe } from '../../../lib/settings'
import { manPhoto } from './NbaBuilds'
import { sfx } from '../../../lib/juice'
import { SpeedSeg } from '../../simFlow'
import { BoxSheet } from '../../app/SquadSeason'
import { fkVars, KLogo, Stamp, Go, ActionBar, Chyron, LowerThird, reduced, splitName } from '../kit'

// GAME DAY (NbaGame.jsx opens it): the GM's game as a broadcast, the way football's is (Week.jsx, gameday.css). On top
// the game's bar, the scorebug (the running clock, team fouls, the bonus) and the speed (SLOW, NORMAL, FAST, pause, SIM
// TO END); under them the game so far (the last basket, the run, who has the points, the score by quarter) beside the
// play-by-play and the box score: one column on a phone, two on a wide screen. The plays are the sim's own (game.js
// keeps a scoring log for the screen: every basket, trip to the line and foul, with the clock). Then the final.
//   row: a game played (the log's row) · pend: a game waiting on its key moment (F.pend), shown up to its whistle
//   fin: the final · moLine: the key moment's line for the final (NbaGame.jsx momentLine) · onEnd: the clock ran out
const sides = (F, row) => { const a = row.home ? row.opp : F.team, h = row.home ? F.team : row.opp; return { a, h, as: row.home ? row.them : row.us, hs: row.home ? row.us : row.them } }

// ── The clock ────────────────────────────────────────────────────────────────
// a period's length and where it starts in the game's seconds (four 12-minute quarters, 5-minute overtimes)
const perLen = p => (p <= 4 ? 720 : 300)
const perStart = p => (p <= 5 ? (p - 1) * 720 : 2880 + (p - 5) * 300)
const tOf = e => perStart(e.p) + perLen(e.p) - e.c
// where the game is at T: the period and the time left in it; an exact period's end (the clock stopped there) is a break
function clockAt(T) {
  const p = T < 2880 ? Math.floor(T / 720) + 1 : 5 + Math.floor((T - 2880) / 300)
  if (T > 0 && Math.abs(T - perStart(p)) < 1e-6) return { p: p - 1, left: 0, brk: true }
  return { p, left: perStart(p) + perLen(p) - T, brk: false }
}
// the broadcast's clock: 7:42, and under a minute the tenths (24.3)
const clockText = s => (s >= 60 ? `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}` : `${(Math.ceil(s * 10) / 10).toFixed(1)}`)
const PER = ['1ST', '2ND', '3RD', '4TH']
const perTag = p => (p <= 4 ? PER[p - 1] : p === 5 ? 'OT' : `${p - 4}OT`)
const perQ = p => (p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `${p - 4}OT`)
const perCol = i => (i < 4 ? i + 1 : i === 4 ? 'OT' : `${i - 3}OT`)
// "FINAL", "FINAL/OT", "FINAL/2OT"
export const finalText = ot => (ot ? `FINAL/${ot > 1 ? ot : ''}OT` : 'FINAL')
// a period's end, the way the broadcast says it
const breakText = (p, nPer) => (p === 2 ? 'Halftime' : p === 4 && nPer > 4 ? 'End of regulation' : p <= 4 ? `End of the ${['1st', '2nd', '3rd', '4th'][p - 1]} quarter` : `End of ${p === 5 ? 'overtime' : `${p - 4}OT`}`)
const GAME_MS = 40000                    // NORMAL: 48 minutes in about 40 seconds
const BREAK_MS = 1100                    // the clock stops at a period's end for a beat
const SPEEDS = [[2, 'Slow'], 'pause', [1, 'Normal'], [0.4, 'Fast']]
const SPEED_KEY = 'bap_frnba_speed'
const readSpeed = () => { try { const v = Number(localStorage.getItem(SPEED_KEY)); return [2, 1, 0.4].includes(v) ? v : 1 } catch { return 1 } }
const keepSpeed = v => { try { localStorage.setItem(SPEED_KEY, String(v)) } catch { /* (private mode: the choice lasts the visit) */ } }

// ── Two teams in one colour (CHI and HOU both red, SAS and BKN both black) ────
// The GM's team keeps its colours; the other side changes the way an away team does: its second colour, else white,
// else near-black. With Colorblind mode on (Settings, settings.js cbSafe; MgStage.jsx does the same in the moments)
// the two must also differ in lightness, not just hue.
const AWAY = '#e8edf2', DARK = '#202326'
const rgb = h => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128] }
const far = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) }
const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
function slabVars(bg, stripe) {
  const dark = lum(bg) > 0.18
  const st = contrast(bg, stripe) >= 1.4 ? stripe : dark ? '#0b0c0e' : '#ffffff'
  return { '--tc': bg, '--tc2': st, '--tct': dark ? '#0b0c0e' : '#ffffff', '--tc2t': lum(st) > 0.18 ? '#0b0c0e' : '#ffffff', '--tca': contrast(bg, '#0b0c0e') >= 3 ? bg : '#ffffff' }
}
export function gameVars(keep, other) {
  const A = fkVars(keep), B = fkVars(other)
  if (!A || !B) return { [keep]: A, [other]: B }
  const cb = cbSafe()
  const apart = (x, y) => far(x, y) >= 110 && (!cb || contrast(x, y) >= 3)
  if (apart(A['--tc'], B['--tc'])) return { [keep]: A, [other]: B }
  const t = TEAM[other]
  const c2 = t?.color2 && lum(t.color2) < 0.012 ? DARK : t?.color2
  const bg = [c2, AWAY, DARK].find(c => c && apart(A['--tc'], c)) ?? (contrast(A['--tc'], AWAY) >= contrast(A['--tc'], DARK) ? AWAY : DARK)
  return { [keep]: A, [other]: slabVars(bg, bg === c2 ? B['--tc'] : t?.color ?? '#0b0c0e') }
}

// ── The plays, in the broadcast's words ─────────────────────────────────────
// (the sim knows the shot: a three, at the rim, a mid-range jumper, a putback, and who passed; the distance and the
// kind of look are laid out from the play itself, the same every time it's shown)
const hashOf = x => { let h = 2166136261; const s = String(x); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
const lastOf = p => (p ? splitName(p.n).last || p.n : 'Player')
function shotText(e, p) {
  const r = hashOf(`${e.w}-${e.p}-${e.c}-${e.hs}-${e.as}`)
  const pick = list => list[r % list.length]
  const ft = (lo, hi) => lo + ((r >>> 7) % (hi - lo + 1))
  const big = p && (p.p === 'C' || p.p === 'PF' || p.g === 'big')
  const ast = e.a != null
  if (e.y === 'three') {
    if (ast) { const d = (r >>> 3) % 5 === 0 ? 22 : ft(24, 27); return `${d}' three-point jumper` }
    const d = ft(24, 28)
    return pick([`${d}' pull-up three-pointer`, `${d}' step-back three-pointer`, `${d}' three-point jumper`, `${d}' pull-up three-pointer`])
  }
  if (e.y === 'mid') {
    if (big) { const d = ft(7, 17); return d <= 10 ? pick([`${d}' hook shot`, `${d}' turnaround hook shot`, `${d}' jumper`]) : pick([`${d}' turnaround jumper`, `${d}' jumper`, `${d}' fadeaway jumper`]) }
    const d = ft(9, 21)
    if (ast) return pick([`${d}' jumper`, `${d}' pull-up jumper`, `${d}' jumper`])
    return d <= 12 ? pick([`${d}' floater`, `${d}' pull-up jumper`, `${d}' running jumper`]) : pick([`${d}' pull-up jumper`, `${d}' step-back jumper`, `${d}' fadeaway jumper`, `${d}' turnaround jumper`])
  }
  if (e.pb) return big ? pick(['putback dunk', "2' putback layup", "1' tip shot"]) : pick(["2' putback layup", "1' tip shot"])
  if (big) return ast ? pick(['alley-oop dunk', 'dunk', "2' layup", 'dunk', "3' hook shot"]) : pick(['dunk', "3' hook shot", "2' layup", "4' turnaround hook shot", "1' layup"])
  return ast ? pick(["2' cutting layup", "1' layup", "3' layup", 'cutting dunk', "2' layup"]) : pick(["2' driving layup", "3' driving finger roll layup", "1' reverse layup", "5' driving floating layup", 'driving dunk', "2' driving layup"])
}
function playText(e, M) {
  if (e.y === 'ft') return e.of === 1 ? `${lastOf(M(e.w))} makes free throw 1 of 1` : `${lastOf(M(e.w))} makes ${e.n} of ${e.of} free throws`
  return `${lastOf(M(e.w))} ${shotText(e, M(e.w))}${e.a != null ? ` (${lastOf(M(e.a))} assists)` : ''}`
}
const ptsOf = e => (e.y === 'f' ? 0 : e.y === 'ft' ? e.n : e.y === 'three' ? 3 : 2)

// the game's tag: "NOV 6 · GAME 23", "FIRST ROUND · GAME 4", "NBA FINALS · GAME 7", "PLAY-IN TOURNAMENT"
function seriesGameNo(F, b) {
  const P = F.po
  if (!P || !b) return null
  for (const S of [...(P.S ?? []), ...(P.all ?? []).flat()]) {
    if (!((S.hi === b.h && S.lo === b.a) || (S.hi === b.a && S.lo === b.h))) continue
    const k = (S.g ?? []).findIndex(x => x.h === b.h && x.hs === b.hs && x.as === b.as)
    if (k >= 0) return k + 1
  }
  return null
}
export function gameTag(F, { row = null, b = null, pend = null } = {}) {
  if (pend) {
    if (pend.po != null) return F.phase === 'playin' || pend.po < 0 ? 'PLAY-IN TOURNAMENT' : `${ROUND_NAME[pend.po]}${pend.n ? ` · GAME ${pend.n}` : ''}`
    return `${dateText(F, pend.d)} · GAME ${(F.log ?? []).filter(x => !x.po).length + 1}`.toUpperCase()
  }
  const po = row?.po ?? b?.po ?? null
  if (po) { if (po === 'PLAY-IN') return 'PLAY-IN TOURNAMENT'; const n = seriesGameNo(F, b); return `${po}${n ? ` · GAME ${n}` : ''}` }
  const d = row?.d ?? b?.d
  const opp = row ? row.opp : b ? (b.h === F.team ? b.a : b.h) : null
  const k = (F.log ?? []).filter(x => !x.po).findIndex(x => x.d === d && x.opp === opp)
  return `${d != null ? `${dateText(F, d)} · ` : ''}${k >= 0 ? `GAME ${k + 1}` : 'REGULAR SEASON'}`.toUpperCase()
}

// ── GAME DAY: live, then the final ───────────────────────────────────────────
export default function GameDay({ F, row = null, pend = null, fin = false, owner, moLine = null, onEnd, onDone }) {
  const b = row ? F.box?.[row.bx] ?? null : null
  const L = useMemo(() => (row ? eventsOf(b) : logOf(pend?.G)) ?? null, [row, pend]) // eslint-disable-line react-hooks/exhaustive-deps
  const ev = useMemo(() => (L ?? []).map(e => ({ ...e, t: tOf(e) })), [L])
  const h = row ? (row.home ? F.team : row.opp) : pend.h
  const a = row ? (row.home ? row.opp : F.team) : pend.a
  const opp = h === F.team ? a : h
  const V = useMemo(() => gameVars(F.team, opp), [opp]) // eslint-disable-line react-hooks/exhaustive-deps
  const nPer = row ? 4 + (row.ot || 0) : pend.G?.per ?? 4
  const endT = row ? perStart(nPer + 1) : pend.G?.el ?? 2856
  // the men, looked up once (the two rosters, then anyone: a man traded since)
  const M = useMemo(() => { const m = new Map(); for (const s of [h, a]) for (const p of F.teams[s]?.r ?? []) m.set(p.i, p); return i => m.get(i) ?? manOf(F, i) }, [h, a]) // eslint-disable-line react-hooks/exhaustive-deps

  const [T, setT] = useState(fin ? endT : 0)
  const Tr = useRef(fin ? endT : 0)
  const hold = useRef(0)
  const ended = useRef(fin)
  const [speed, setSpeed] = useState(readSpeed)
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState(fin ? 'box' : 'pbp')
  const end = () => { if (ended.current) return; ended.current = true; onEnd() }
  useEffect(() => {
    if (fin || paused) return undefined
    if (reduced() && !pend) { Tr.current = endT; setT(endT); end(); return undefined }
    let last = performance.now(), lastSet = 0, raf
    const rate = 2880 / (GAME_MS * speed)
    const step = now => {
      const dt = Math.min(100, now - last); last = now
      if (now >= hold.current) {
        const was = Tr.current
        let next = Math.min(endT, was + dt * rate)
        // (a period's end: the clock stops there for a beat, End of the 1st quarter, Halftime)
        const c = clockAt(was), pe = perStart(c.brk ? c.p + 2 : c.p + 1)
        if (pe < endT - 1e-6 && next >= pe) { next = pe; hold.current = now + BREAK_MS * Math.min(1.5, speed); sfx('tick') }
        Tr.current = next
      }
      if (Tr.current >= endT) { setT(endT); end(); return }
      if (now - lastSet > 60) { lastSet = now; setT(Tr.current) }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [fin, paused, speed, endT]) // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { Tr.current = endT; setT(endT); hold.current = 0; end() }
  useEffect(() => { if (fin) setTab(t => (t === 'pbp' ? 'box' : t)) }, [fin])

  // the game at T
  const tt = fin ? endT : Math.min(T, endT)
  const shown = useMemo(() => ev.filter(e => e.t <= tt + 1e-6), [ev, tt])
  const scored = useMemo(() => shown.filter(e => ptsOf(e) > 0), [shown])
  const lastScore = scored[scored.length - 1] ?? null
  // (no log, a game picked up after a reload: the score by the quarters done)
  const qDone = k => { const q = row?.q ?? b?.q ?? []; let s = 0; for (let i = 0; i < q.length; i++) if (perStart(i + 2) <= tt + 1e-6) s += q[i][k] ?? 0; return s }
  let hs = L ? lastScore?.hs ?? 0 : qDone(0), as = L ? lastScore?.as ?? 0 : qDone(1)
  if (fin && row) { hs = row.home ? row.us : row.them; as = row.home ? row.them : row.us }
  const ck = clockAt(tt)
  const status = fin ? { one: finalText(row?.ot) } : ck.brk ? (ck.p === 2 ? { one: 'HALF' } : { top: 'END', sub: perTag(ck.p) }) : { top: perTag(ck.p), sub: clockText(ck.left) }
  const fouls = k => shown.filter(e => e.y === 'f' && e.p === ck.p && e.k === k).length
  const showFouls = !fin && !!L && !ck.brk && tt > 0
  const tag = gameTag(F, { row, b, pend })

  return (
    <div className={`fk fk-root fg gd nb-gdl${fin ? ' is-final' : ''}`} style={fkVars(F.team)} role="dialog" aria-label="Game">
      <header className="gd-head">
        <div className="gd-weekrow">
          <div className="gd-week" style={fkVars(F.team)}><b>{tag}</b><span>{fin ? 'FINAL' : <><i className="gd-live" />LIVE</>}</span></div>
          {!fin && row && <button type="button" className="nb-leave" onClick={() => { sfx('tap'); onDone() }}>Leave game</button>}
        </div>
        <div className="gd-barrow">
          <div className="nb-bugwrap">
            <NbaBug a={a} h={h} as={as} hs={hs} V={V} status={status} final={fin} />
            {showFouls && <TeamFouls a={a} h={h} fa={fouls('a')} fh={fouls('h')} />}
          </div>
          {!fin && (
            <div className="gd-ctl">
              <SpeedSeg className="gd-speed" steps={SPEEDS} speed={speed} paused={paused} onSpeed={v => { setSpeed(v); keepSpeed(v); setPaused(false) }} onPause={() => setPaused(p => !p)} onSkip={skip} skipLabel={pend ? ['Skip to', 'moment'] : ['Sim to', 'end']} />
            </div>
          )}
        </div>
      </header>
      <div className="gd-main">
        <div className="gd-left">
          {!fin && <Now V={V} a={a} h={h} ck={ck} nPer={nPer} last={lastScore} M={M} L={L} T={tt} />}
          {!fin && L && <Flow V={V} a={a} h={h} shown={scored} M={M} />}
          {!fin && <LineScore a={a} h={h} ev={scored} T={tt} q={L ? null : row?.q} n={Math.max(4, ck.p)} />}
          {fin && row && <Final F={F} row={row} b={b} V={V} owner={owner} moLine={moLine} onDone={onDone} />}
        </div>
        <div className="gd-right">
          <div className="gd-tabs nb-tabs" role="tablist" aria-label="Game">
            {[['pbp', 'Play-by-play'], ['box', 'Box score']].map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); sfx('tap') }}>{l}</button>)}
          </div>
          {tab === 'pbp' && <PlayByPlay V={V} a={a} h={h} ev={scored} M={M} L={L} T={tt} nPer={fin ? nPer : ck.p} fin={fin} ot={row?.ot} />}
          {tab === 'box' && (fin && b ? <NbaBoxSheet F={F} b={b} owner={owner} portal={false} /> : <LiveBox F={F} V={V} a={a} h={h} shown={shown} M={M} L={L} />)}
        </div>
      </div>
    </div>
  )
}

// the scorebug (kit.jsx Scorebug's look): the clock or the break; on the final the winner's number in white, the loser's
// quiet (the bar keeps its colour: the team stays readable)
function NbaBug({ a, h, as, hs, V, status, final }) {
  const T = (s, pts, win) => (
    <span className={`fk-bug-t${win === true ? ' is-win' : win === false ? ' is-lost' : ''}`} style={V[s]}>
      <KLogo s={s} size={24} />
      <span className="fk-bug-n"><b>{s}</b></span>
      <strong key={pts} className="fk-bug-pts">{pts}</strong>
    </span>
  )
  return (
    <div className={`fk-bug nb-bug${final ? ' is-final' : ''}`} role="status" aria-label={`${a} ${as}, ${h} ${hs}, ${status.one ?? `${status.top} ${status.sub}`}`}>
      {T(a, as, final ? as > hs : null)}
      {T(h, hs, final ? hs > as : null)}
      <span className="fk-bug-st">{status.one ? <b className="fk-bug-final">{status.one}</b> : <><b>{status.top}</b><span>{status.sub}</span></>}</span>
    </div>
  )
}
// under the bug: each side's team fouls this period and the bonus (the fifth team foul in a period is two shots)
function TeamFouls({ a, h, fa, fh }) {
  const one = (s, mine, theirs) => (
    <span key={s}>
      <em>{mine} {mine === 1 ? 'foul' : 'fouls'}</em>
      {theirs >= 4 && <b>BONUS</b>}
    </span>
  )
  return <div className="nb-tf" aria-label="Team fouls">{one(a, fa, fh)}{one(h, fh, fa)}<span className="nb-tf-sp" /></div>
}

// the game right now: the last basket (or the break, the tip)
function Now({ V, a, h, ck, nPer, last, M, L, T }) {
  const idle = txt => <section className="gd-field is-idle"><div className="gd-idle-bar"><span className="gd-idle">{txt}</span></div></section>
  if (ck.brk) return idle(breakText(ck.p, ck.p === 4 ? 5 : nPer).toUpperCase())
  if (T < 1) return idle('TIP-OFF')
  if (!L || !last) return idle(ck.p <= 4 ? `${perTag(ck.p)} QUARTER` : 'OVERTIME')
  const s = last.k === 'h' ? h : a
  const pts = ptsOf(last)
  return (
    <section key={`${last.p}-${last.c}-${last.hs}-${last.as}`} className="nb-now" style={V[s]} aria-live="polite">
      <KLogo s={s} size={34} />
      <span className="nb-now-txt"><small>{perQ(last.p)} {clockText(last.c)} · {last.y === 'ft' ? `${pts} FT` : pts === 3 ? '3 PTS' : '2 PTS'}</small><b>{playText(last, M)}</b></span>
      <span className="nb-now-sc"><small>{a}-{h}</small><b>{last.as}-{last.hs}</b></span>
    </section>
  )
}

// the run (unanswered points), the lead changes, the ties, the biggest lead; who has the points
function Flow({ V, a, h, shown, M }) {
  let runK = null, run = 0
  for (let j = shown.length - 1; j >= 0; j--) { const e = shown[j]; if (runK == null) runK = e.k; if (e.k !== runK) break; run += ptsOf(e) }
  let lc = 0, ties = 0, led = 0, prev = 0
  const big = { h: 0, a: 0 }
  for (const e of shown) {
    const m = e.hs - e.as
    if (m === 0 && prev !== 0) ties++
    if (m !== 0) { if (led !== 0 && Math.sign(m) !== led) lc++; led = Math.sign(m) }
    big.h = Math.max(big.h, m); big.a = Math.max(big.a, -m); prev = m
  }
  const bigS = big.h >= big.a ? h : a, bigV = Math.max(big.h, big.a)
  const runS = runK === 'h' ? h : a
  // the leading scorers so far, two a team
  const pts = {}
  for (const e of shown) pts[e.w] = (pts[e.w] ?? 0) + ptsOf(e)
  const top = k => [...new Set(shown.filter(e => e.k === k).map(e => e.w))].sort((x, y) => pts[y] - pts[x]).slice(0, 2)
  return (
    <>
      {run >= 8 && <div className="nb-run" style={V[runS]}><KLogo s={runS} size={22} /><b>{nick(runS)} on a {run}-0 run</b></div>}
      <div className="gd-drive nb-flow">
        <span><b>{lc}</b> lead {lc === 1 ? 'change' : 'changes'}</span>
        <span><b>{ties}</b> {ties === 1 ? 'tie' : 'ties'}</span>
        <span>{bigV > 0 ? <><b>{bigV}</b> {bigS} best lead</> : 'No lead yet'}</span>
      </div>
      <div className="nb-ldrs">
        {[['a', a], ['h', h]].map(([k, s]) => (
          <div key={s} className="nb-ldr" style={V[s]}>
            <KLogo s={s} size={20} /><b>{s}</b>
            <span>{top(k).map(i => `${lastOf(M(i))} ${pts[i]}`).join(' · ') || 'No points yet'}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// the score by quarter so far (football's Scoring tab's table)
function LineScore({ a, h, ev, T, q, n }) {
  const line = k => {
    const out = Array(n).fill(0)
    if (q) q.forEach((x, i) => { if (i < n && perStart(i + 2) <= T + 1e-6) out[i] = x[k === 'h' ? 0 : 1] })
    else for (const e of ev) if (e.k === k && e.p <= n) out[e.p - 1] += ptsOf(e)
    return out
  }
  return (
    <div className="fg-quarters nb-ls" style={{ '--n': n }}>
      <span className="is-head" />{Array.from({ length: n }, (_, i) => <span key={i} className="is-head">{perCol(i)}</span>)}<span className="is-head">T</span>
      {[['a', a], ['h', h]].map(([k, s]) => { const x = line(k); return [<span key={`${s}n`} className="is-team"><KLogo s={s} size={18} />{s}</span>, ...x.map((v, i) => <span key={`${s}${i}`}>{v}</span>), <span key={`${s}t`} className="is-tot">{x.reduce((p, y) => p + y, 0)}</span>] })}
    </div>
  )
}

// ── Play-by-play: every basket, newest first, the breaks between periods ─────
function PlayByPlay({ V, a, h, ev, M, L, T, nPer, fin, ot }) {
  if (!L) return <div className="gd-list"><div className="gd-empty">No play-by-play was kept for this game</div></div>
  const list = ev.map((e, j) => ({ t: e.t, j, key: `e${e.p}-${e.c}-${e.hs}-${e.as}`, e }))
  for (let p = 1; p <= nPer; p++) {
    const t = perStart(p + 1)
    if (t > T + 1e-6) continue
    const at = [...ev].reverse().find(x => x.t <= t + 1e-6)
    list.push({ t: t + 0.001, j: 1e6, key: `b${p}`, brk: fin && p === nPer ? finalText(ot).replace('FINAL', 'Final') : breakText(p, fin ? nPer : p === 4 ? 5 : nPer), as: at?.as ?? 0, hs: at?.hs ?? 0 })
  }
  list.sort((x, y) => y.t - x.t || y.j - x.j)
  if (!list.length) return <div className="gd-list"><div className="gd-empty">Tip-off</div></div>
  return (
    <ol className="gd-list nb-pbp">
      {list.map(x => {
        if (x.brk) return <li key={x.key} className="nb-pbp-brk"><b>{x.brk}</b><span>{a} {x.as}, {h} {x.hs}</span></li>
        const e = x.e, s = e.k === 'h' ? h : a
        return (
          <li key={x.key} className="fg-play nb-play" style={V[s]}>
            <span className="fg-play-when"><b>{perQ(e.p)}</b>{clockText(e.c)}</span>
            <span className="fg-play-txt">{playText(e, M)}</span>
            <span className="nb-play-sc"><i className={e.k === 'a' ? 'is-up' : ''}>{e.as}</i>-<i className={e.k === 'h' ? 'is-up' : ''}>{e.hs}</i></span>
          </li>
        )
      })}
    </ol>
  )
}

// the box while the game is on: the points so far, from the plays (the full lines come with the final)
function LiveBox({ F, V, a, h, shown, M, L }) {
  const [k, setK] = useState(a === F.team ? 'a' : 'h')
  if (!L) return <div className="gd-list"><p className="gd-note">The players' lines come in with the final.</p></div>
  const s = k === 'h' ? h : a
  const lines = {}
  const of = i => (lines[i] ??= { i, pts: 0, fgm: 0, tpm: 0, ftm: 0, fta: 0, ast: 0, pf: 0 })
  for (const e of shown) {
    if (e.k !== k) continue
    if (e.y === 'f') { of(e.w).pf++; continue }
    const x = of(e.w)
    if (e.y === 'ft') { x.ftm += e.n; x.fta += e.of; x.pts += e.n; continue }
    x.fgm++; x.pts += e.y === 'three' ? 3 : 2; if (e.y === 'three') x.tpm++
    if (e.a != null) of(e.a).ast++
  }
  const rows = Object.values(lines).sort((x, y) => y.pts - x.pts || y.ast - x.ast)
  const COLS = [['PTS', x => x.pts], ['FGM', x => x.fgm], ['3PM', x => x.tpm], ['FT', x => `${x.ftm}-${x.fta}`], ['AST', x => x.ast], ['PF', x => x.pf]]
  return (
    <div className="gd-list nb-livebox">
      <div className="nb-seg" role="tablist" aria-label="Team">
        {[['a', a], ['h', h]].map(([kk, t]) => <button key={t} type="button" role="tab" aria-selected={k === kk} className={k === kk ? 'is-on' : ''} style={V[t]} onClick={() => { setK(kk); sfx('tap') }}><KLogo s={t} size={18} />{nick(t)}</button>)}
      </div>
      {rows.length ? <MenTable cols={COLS} rows={rows.map(x => ({ x, p: M(x.i) }))} s={s} /> : <div className="gd-empty">No points yet</div>}
      <p className="gd-note">Live: the scoring so far. Rebounds, steals and blocks come in with the final.</p>
    </div>
  )
}

// ── The box score ────────────────────────────────────────────────────────────
// SquadSeason.jsx BoxSheet in the kit: the final with the score by quarter, the two teams' lines, each team's leaders,
// then each team's men (a tab a team): the starters, the bench, the men who didn't play and why, the team's totals.
// The name stays put and the numbers slide under it on a phone.
const COLS_FULL = [
  ['MIN', x => x.min], ['PTS', x => x.pts], ['REB', x => x.reb], ['AST', x => x.ast],
  ['FG', x => `${x.fgm}-${x.fga}`], ['3PT', x => `${x.tpm}-${x.tpa}`], ['FT', x => `${x.ftm}-${x.fta}`],
  ['OREB', x => x.oreb ?? 0], ['STL', x => x.stl], ['BLK', x => x.blk], ['TO', x => x.tov], ['PF', x => x.pf], ['+/-', x => (x.pm > 0 ? `+${x.pm}` : x.pm)],
]
const DNP_TEXT = { inj: 'DNP - Injury', injury: 'DNP - Injury', rest: 'DNP - Rest', cd: "DNP - Coach's Decision", coach: "DNP - Coach's Decision", inact: 'Inactive', inactive: 'Inactive', tw: 'Inactive', nwt: 'Not With Team', sus: 'Suspended' }
const dnpText = v => (v == null ? null : DNP_TEXT[String(v).toLowerCase()] ?? String(v))
const played = l => (l.min ?? 0) > 0 || l.fga || l.fta || l.reb || l.ast || l.pf || l.tov || l.stl || l.blk || l.pts
// the men who didn't play: the box's own word (the sim: b.dnp[team] or a line's dnp), else the dressed men with no
// minutes (the coach's decision) and, for the last game, the men on the roster who weren't in it (hurt, or resting)
function dnpOf(F, b, s) {
  const lines = b.box?.[s] ?? []
  const out = []
  const given = b.dnp?.[s]
  for (const l of lines) if (!played(l)) out.push({ i: l.i, why: dnpText(l.dnp) ?? "DNP - Coach's Decision" })
  if (Array.isArray(given)) {
    for (const d of given) {
      const i = typeof d === 'object' ? d.i : d
      if (!out.some(x => x.i === i) && !lines.some(l => l.i === i && played(l))) out.push({ i, why: dnpText(typeof d === 'object' ? d.r ?? d.why ?? d.k : null) ?? 'Inactive' })
    }
  } else if (!given && F.box?.[F.box.length - 1] === b) {
    for (const p of F.teams[s]?.r ?? []) if (!lines.some(l => l.i === p.i)) out.push({ i: p.i, why: p.inj?.g > 0 ? 'DNP - Injury' : p.tw ? 'Inactive' : 'DNP - Rest' })
  }
  return out
}
const shortName = n => { const { first, last } = splitName(n); return first ? `${first[0]}. ${last}` : last }
const pct = (m, a) => (a ? `${((100 * m) / a).toFixed(1)}%` : '-')
function MenTable({ cols, rows, sections = null, total = null, pcts = null, s }) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const f = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    f()
    el.addEventListener('scroll', f, { passive: true })
    window.addEventListener('resize', f)
    return () => { el.removeEventListener('scroll', f); window.removeEventListener('resize', f) }
  }, [rows.length])
  const row = ({ x, p, dnp }, key) => (
    <tr key={key} className={`${p?.b != null ? 'is-mine' : ''}${dnp ? ' is-dnp' : ''}`}>
      <th scope="row" className="nb-bx-name"><b>{p ? shortName(p.n) : '-'}</b><small>{p?.p ?? ''}</small></th>
      {dnp ? <td colSpan={cols.length} className="nb-bx-dnp"><span>{dnp}</span></td> : cols.map(([k, f]) => <td key={k} className={k === 'PTS' ? 'is-pts' : undefined}>{f(x)}</td>)}
    </tr>
  )
  return (
    <div className={`nb-bx-wrap${more ? ' has-more' : ''}`}>
      <div className="nb-bx-scroll" ref={ref} tabIndex={0} role="region" aria-label={`${TEAM[s]?.name ?? s} players`}>
        <table className="nb-bx">
          <thead><tr><th scope="col" className="nb-bx-name">{nick(s)}</th>{cols.map(([k]) => <th key={k} scope="col">{k}</th>)}</tr></thead>
          {sections ? sections.map(sec => sec.rows.length > 0 && (
            <tbody key={sec.k}>
              <tr className="nb-bx-sec"><th scope="rowgroup" className="nb-bx-name">{sec.k}</th><td colSpan={cols.length} /></tr>
              {sec.rows.map((r, j) => row(r, `${sec.k}${j}`))}
            </tbody>
          )) : <tbody>{rows.map((r, j) => row(r, j))}</tbody>}
          {total && (
            <tfoot>
              <tr className="nb-bx-tot"><th scope="row" className="nb-bx-name"><b>Totals</b></th>{cols.map(([k, f]) => <td key={k}>{k === 'MIN' || k === '+/-' ? '' : f(total)}</td>)}</tr>
              {pcts && <tr className="nb-bx-pct"><th scope="row" className="nb-bx-name" />{cols.map(([k]) => <td key={k}>{pcts[k] ?? ''}</td>)}</tr>}
            </tfoot>
          )}
        </table>
      </div>
      {more && <span className="nb-bx-more" aria-hidden="true">›</span>}
    </div>
  )
}
function MenBox({ F, b, s }) {
  const lines = (b.box?.[s] ?? []).filter(played)
  const p = l => manOf(F, l.i)
  const st = lines.filter(l => l.st), bench = lines.filter(l => !l.st).sort((x, y) => (y.min ?? 0) - (x.min ?? 0))
  const dnp = dnpOf(F, b, s)
  const total = lines.reduce((t, l) => { for (const k of ['pts', 'reb', 'oreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']) t[k] = (t[k] ?? 0) + (l[k] ?? 0); return t }, {})
  const sections = [
    { k: 'Starters', rows: st.map(l => ({ x: l, p: p(l) })) },
    { k: 'Bench', rows: [...bench.map(l => ({ x: l, p: p(l) })), ...dnp.map(d => ({ x: null, p: manOf(F, d.i), dnp: d.why }))] },
  ]
  return <MenTable cols={COLS_FULL} rows={lines} sections={sections} total={total} pcts={{ FG: pct(total.fgm, total.fga), '3PT': pct(total.tpm, total.tpa), FT: pct(total.ftm, total.fta) }} s={s} />
}
// the whole sheet: on the final (in place) and from the hub's last result (over the page)
export function NbaBoxSheet({ F, b, owner, onClose = null, portal = true }) {
  const s = b.h === F.team || b.a === F.team ? F.team : b.a, opp = b.h === s ? b.a : b.h
  const home = b.h === s
  const rosterOf = t => (b.box?.[t] ?? []).map(l => { const p = manOf(F, l.i); return { k: String(l.i), n: p?.n ?? '-', s: t === F.team && p?.b != null, pos: 'bat', tag: p?.p ?? '' } })   // (roleOf reads a tag off 'bat': his spot, PG to C)
  const linesOf = t => Object.fromEntries((b.box?.[t] ?? []).map(l => [String(l.i), { ...l, mn: l.min }]))
  const sumOf = list => list.reduce((x, l) => { for (const k of ['fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'reb', 'ast', 'stl', 'blk', 'tov']) x[k] = (x[k] ?? 0) + (l[k] ?? 0); return x }, {})
  const us = sumOf(b.box?.[s] ?? []), them = sumOf(b.box?.[opp] ?? [])
  us.to = us.tov; them.to = them.tov
  const game = { s: linesOf(s), us, them }
  const r = { team: s, roster: rosterOf(s) }
  const my = home ? b.hs : b.as, op = home ? b.as : b.hs
  const q = b.q ? [b.q.map(x => x[home ? 0 : 1]), b.q.map(x => x[home ? 1 : 0])] : null
  const g = { i: 0, opp, home, my, op, ot: b.ot, po: false, where: gameTag(F, { b }) }
  return (
    <BoxSheet r={r} sport="bucket" g={g} box={{ reg: [game], po: [] }} owner={owner} onClose={onClose} quarters={q} portal={portal} status={finalText(b.ot).replace('FINAL', 'Final')}
      opp={{ r: { roster: rosterOf(opp) }, game: { s: linesOf(opp) } }}
      table={side => <MenBox key={side.team} F={F} b={b} s={side.team} />}
      className={portal ? 'fk fk-root gd-sheet-modal nb-boxsheet' : 'gd-sheet nb-boxsheet'} />
  )
}

// THE FINAL: the score by quarter, the W or L, the line a broadcaster gives it, the series, each team's top scorer
function Final({ F, row, b, V, owner, moLine, onDone }) {
  const { a, h, as, hs } = sides(F, row)
  const top = s => (b?.box?.[s] ?? []).slice().sort((x, y) => y.pts - x.pts || y.reb + y.ast - x.reb - x.ast)[0]
  const S = row.po && F.po ? [...(F.po.S ?? []), ...(F.po.all ?? []).flat()].find(x => (x.hi === F.team && x.lo === row.opp) || (x.lo === F.team && x.hi === row.opp)) : null
  const otWord = row.ot ? (row.ot === 1 ? ' in overtime' : row.ot === 2 ? ' in double overtime' : row.ot === 3 ? ' in triple overtime' : ` in ${row.ot} overtimes`) : ''
  const head = `${nick(row.w ? F.team : row.opp)} ${Math.max(row.us, row.them)}, ${nick(row.w ? row.opp : F.team)} ${Math.min(row.us, row.them)}`
  const q = row.q ?? b?.q ?? []
  const n = Math.max(4, q.length)
  const Team = (s, k, pts, lose) => (
    <div className={`gd-fin-t nb-fin-t${lose ? ' is-lost' : ''}`} style={V[s]}>
      <KLogo s={s} size={30} /><b>{n > 5 ? s : TEAM[s].nick}</b>
      {Array.from({ length: n }, (_, i) => <span key={i}>{q[i]?.[k] ?? 0}</span>)}
      <strong>{pts}</strong>
    </div>
  )
  return (
    <section className="gd-final nb-final">
      <div className="gd-fin nb-fin">
        <div className="gd-fin-h" style={{ '--n': n }}><span>{finalText(row.ot)}</span>{Array.from({ length: n }, (_, i) => <span key={i}>{perCol(i)}</span>)}<span>T</span></div>
        <div style={{ '--n': n }}>{Team(a, 1, as, as < hs)}</div>
        <div style={{ '--n': n }}>{Team(h, 0, hs, hs < as)}</div>
      </div>
      <div className="fg-head gd-hl">
        <Stamp kind={row.w ? 'w' : 'l'} delay={250}>{row.w ? 'WIN' : 'LOSS'}</Stamp>
        <span><h2>{head}</h2><p>{finalLine(F, row, S, otWord)}</p></span>
      </div>
      {moLine && <p className="nb-gd-sub">{moLine}</p>}
      <div className="fg-feed nb-tops">
        <Chyron tone="ink" size="s" title="Top scorers" />
        {[F.team, row.opp].map(s => { const l = top(s); const p = l && manOf(F, l.i); return p ? <LowerThird key={s} name={p.n} pos={p.p} num={p.num} photo={manPhoto(F, p)} team={s} mine={p.b != null ? owner : undefined} size="s" stat={{ v: l.pts, label: 'PTS' }} line={`${s} · ${l.reb} REB · ${l.ast} AST · ${l.fgm}-${l.fga} FG`} /> : null })}
      </div>
      <ActionBar className="gd-go"><Go onClick={() => { sfx('tap'); onDone() }}>Continue</Go></ActionBar>
    </section>
  )
}
// the line under the final: the record it leaves them with, or where the series stands
function finalLine(F, row, S, otWord) {
  const t = `The ${nick(F.team)}`
  if (S) return `${t} ${row.w ? 'win' : 'lose'}${otWord}. ${seriesText(S, F.team)}`
  if (row.po) return `${t} ${row.w ? 'win' : 'lose'}${otWord}`
  const k = (F.log ?? []).filter(x => !x.po).findIndex(x => x.d === row.d && x.opp === row.opp)
  const done = (F.log ?? []).filter(x => !x.po).slice(0, k >= 0 ? k + 1 : undefined)
  const w = done.filter(x => x.w).length, l = done.length - w
  return otWord ? `${t} ${row.w ? 'win' : 'lose'}${otWord} and ${row.w ? 'improve' : 'fall'} to ${w}-${l}` : `${t} ${row.w ? 'improve' : 'fall'} to ${w}-${l}`
}
