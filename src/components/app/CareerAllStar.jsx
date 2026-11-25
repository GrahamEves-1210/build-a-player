import { useEffect, useMemo, useRef, useState } from 'react'
import {
  threePlan, dunkPlan, answerAllStar, withdrawAllStar, recordThree, simThreeFor, recordAttempt, simDunkFor, markLive, settleLive, finishAllStar, aswHurt,
  unlockAllStar, threeLine, dunkLine, threeV, dunkV, tierOf, dunkById, shortNamer, RACKS, DUNK_TRIES,
} from '../../lib/allStar'
import { DUNKS } from '../../lib/mg/dunkcontest'
import { engineFor } from '../../lib/mg'
import { gamesMode, sportOf } from '../../lib/career'
import { minigameOpen } from '../../lib/ads'
import { sfx, haptic, victory } from '../../lib/juice'
import { reducedMotion } from '../simFlow'
import { IconArrow, IconTrophy } from './icons'
import MgStage from './MgStage'
import './career-allstar.css'
import { ASW_LEGACY } from '../../lib/allStarBreak'
import { IconClose } from './icons'

// ALL-STAR SATURDAY (basketball Career): the invitation, then the night: the 3-Point Contest, then the Slam Dunk
// Contest. The contests themselves are lib/allStar.js (the field, the rivals, the judges); the games his rounds are
// played with are lib/mg/threecontest.js and lib/mg/dunkcontest.js, or his grades with Mini Games OFF. Every round he
// finishes is kept on the season at once (setCareer), so a reload comes back to the same spot of the night.
// Rivals go by last name, as the field's shortNamer gives it ("A. Thompson" when two in a field share one).
const andList = a => (a.length > 2 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a.join(' and '))
const TIER_WORD = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' }
const photoOf = name => sportOf({ sport: 'bucket' }).photo?.(name) ?? null
const initials = n => String(n ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('')

// a man on the board: his ESPN headshot (or his initials), his own drawn face for the player
function Head({ row, face }) {
  if (row.me) return <span className="asw-head is-me">{face}</span>
  const src = photoOf(row.name)
  return <span className="asw-head">{src ? <img src={src} alt="" loading="lazy" /> : <b>{initials(row.name)}</b>}</span>
}

// The card that opens the night: the invitations (both, one, or hurt and out)
export function AllStarInvite({ c, setCareer, getD }) {
  const w = c.active.asw, inv = w.inv
  const hurt = aswHurt(c, getD())
  const both = inv.three && inv.dunk
  const go = pick => { setCareer(answerAllStar(c, pick)); sfx(pick.three || pick.dunk ? 'whistle' : 'tap'); haptic('medium') }
  if (hurt) return (
    <div className="sm-moment asw-invite ag-pop">
      <span className="ag-eyebrow">GAME {w.at} · ALL-STAR BREAK</span>
      <h3 className="sm-moment-title">All-Star Saturday</h3>
      <p className="sm-moment-body">{`The league invited ${c.name} to ${both ? 'the 3-Point Contest and the Slam Dunk Contest' : inv.three ? 'the 3-Point Contest' : 'the Slam Dunk Contest'}. He is in the training room, and the team's medical staff won't clear him for Saturday night.`}</p>
      <div className="sm-options"><button className="sm-option" onClick={() => { setCareer(withdrawAllStar(c, [...(c.injuries ?? [])].reverse().find(i => i.year === c.year + 1)?.kind ?? 'injury')); sfx('tap') }}><b>Withdraw</b><small>The league names a replacement. The season picks up after the break.</small></button></div>
    </div>
  )
  return (
    <div className="sm-moment asw-invite ag-pop">
      <span className="ag-eyebrow">GAME {w.at} · ALL-STAR BREAK</span>
      <h3 className="sm-moment-title">{both ? 'Two invitations' : inv.three ? '3-Point Contest' : 'Slam Dunk Contest'}</h3>
      <p className="sm-moment-body">{both
        ? `The league wants ${c.name} on Saturday night twice: the 3-Point Contest, then the Slam Dunk Contest. Eight shooters in one, four dunkers in the other.`
        : inv.three ? `The league invites ${c.name} to the 3-Point Contest on All-Star Saturday. Eight of the best shooters in the league, 27 balls, 70 seconds; the top three go to the final.`
        : `The league invites ${c.name} to the Slam Dunk Contest on All-Star Saturday. Four dunkers, five judges, two dunks in the first round and two in the final.`}</p>
      <div className="sm-options">
        {both && <button className="sm-option" onClick={() => go({ three: true, dunk: true })}><b>Enter both</b><small>The 3-Point Contest first, then the dunk contest to close the night.</small></button>}
        {inv.three && <button className="sm-option" onClick={() => go({ three: true })}><b>{both ? '3-Point Contest only' : 'Accept'}</b><small>Five racks and two deep shots. He picks where the money rack goes.</small></button>}
        {inv.dunk && <button className="sm-option" onClick={() => go({ dunk: true })}><b>{both ? 'Slam Dunk Contest only' : 'Accept'}</b><small>He picks every dunk: easy, medium or hard. Three tries to land each one.</small></button>}
        <button className="sm-option" onClick={() => go({})}><b>Pass</b><small>Rest over the break. No effect on his season.</small></button>
      </div>
    </div>
  )
}

// ── The board: the round's men, the ones who have gone in score order, the rest in the order they go ──
// (bare: the field before a ball is shot, names and teams only)
function Board({ rows, val, through = null, face, title, right = null, sn, bare = false }) {
  return (
    <div className="asw-board">
      <div className="asw-board-head"><span className="ag-eyebrow">{title}</span>{right}</div>
      {rows.map((r, i) => (
        <div key={r.name} className={`asw-row${r.me ? ' is-me' : ''}${r.up ? ' is-up' : ''}${through?.includes(r.name) ? ' is-through' : ''}${through && !through.includes(r.name) ? ' is-out' : ''}${through && i === through.length ? ' is-cutline' : ''}${r.v == null && !bare ? ' is-wait' : ''}`}>
          <span className="asw-row-n">{r.v == null || bare ? '' : i + 1}</span>
          <Head row={r} face={face} />
          <span className="asw-row-name">{r.me ? r.name : sn(r.name)}<small>{r.team}{r.sub ? ` · ${r.sub}` : ''}</small></span>
          {!bare && <span className="asw-row-v">{r.v == null ? '—' : val ? val(r) : r.v}</span>}
        </div>
      ))}
    </div>
  )
}
// (equal scores: the man who went through, the winner of the shoot-off or the dunk-off, above the man who didn't)
const boardRows = (men, scores, cur, through = null, subs = null) => {
  const up = n => (through?.includes(n) ? 1 : 0)
  const done = men.filter(m => scores.has(m.name)).map(m => ({ ...m, v: scores.get(m.name), up: m.name === cur, sub: subs?.get(m.name) ?? null })).sort((a, b) => b.v - a.v || up(b.name) - up(a.name))
  return [...done, ...men.filter(m => !scores.has(m.name)).map(m => ({ ...m, v: null, sub: subs?.get(m.name) ?? null }))]
}

// ── The final standings (lib/allStar.js standingsOf): everyone in the order he finished, the first round's score and
// the final's, his row marked. The dunk contest lists each man's dunks under his name, the judges' totals that make
// up his last number.
const PLACE_WORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']
function finishLine(rows, name, sn) {
  const me = rows.find(r => r.me)
  if (!me || me.champ) return ''
  return `${sn(name)} ${me.tied ? `ties for ${PLACE_WORD[me.place] ?? ord(me.place)}` : `finishes ${PLACE_WORD[me.place] ?? ord(me.place)}`}.`
}
function Standings({ rows, face, sn, dunk = false }) {
  const cut = rows.findIndex(r => !r.through)
  return (
    <div className="asw-board asw-stand">
      <div className="asw-board-head"><span className="ag-eyebrow">FINAL STANDINGS</span><span className="asw-stand-cols"><i>1ST RD</i><i>FINAL</i></span></div>
      {rows.map((r, i) => {
        const dunks = dunk ? (r.through ? r.finalDunks : r.r1Dunks) : null
        return (
          <div key={r.name} className={`asw-row asw-srow${r.me ? ' is-me' : ''}${r.champ ? ' is-champ' : ''}${r.through ? '' : ' is-out'}${i === cut && cut > 0 ? ' is-cutline' : ''}`}>
            <span className="asw-row-n">{r.champ ? <IconTrophy size={16} /> : r.tied ? `T${r.place}` : r.place}</span>
            <Head row={r} face={face} />
            <span className="asw-srow-name"><b>{r.me ? r.name : sn(r.name)}</b><small>{r.team}{dunks?.length ? ` · ${dunks.join(' + ')}` : ''}</small></span>
            <span className="asw-srow-v is-r1">{r.r1 ?? '—'}</span>
            <span className="asw-srow-v">{r.final ?? ''}</span>
          </div>
        )
      })}
    </div>
  )
}

// the reveal: one event at a time, on its own clock; SKIP AHEAD goes straight to the next thing that needs him
function useReveal(ev, start, pace) {
  const [shown, setShown] = useState(start)
  const cur = ev[shown - 1]
  const stopAt = e => !e || e.kind === 'turn' || e.kind === 'champ'
  useEffect(() => {
    if (shown === 0 || shown >= ev.length || stopAt(cur)) return
    const t = setTimeout(() => setShown(n => n + 1), reducedMotion() ? 350 : pace(cur))
    return () => clearTimeout(t)
  }, [shown, ev.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { let n = shown; while (n < ev.length - 1 && !['turn', 'champ', 'cut'].includes(ev[n].kind)) n++; setShown(Math.min(ev.length, n + 1)); sfx('tap') }
  return { shown, setShown, cur, skip, at: stopAt(cur) }
}

// his round on the stage (with ads off for as long as it's open)
function Stage({ c, game, def, v, seed, onDone }) {
  useEffect(() => minigameOpen(), [])
  return <MgStage game={game} def={def} v={Math.min(11, v)} arm={5} seed={seed} sport="bucket" team={c.fit} pos={c.pos} onDone={onDone} />
}

// ════ The 3-Point Contest ════
const THREE_PACE = e => (e.kind === 'cut' ? 3200 : e.kind === 'round' ? 1100 : 2000)
function threeEvText(e, sn, P = null) {
  if (e.kind === 'round') return e.round === 'final' ? 'The final. The lowest first-round score shoots first.' : 'Eight shooters. 27 balls, 70 seconds, 40 points on the rack.'
  if (e.kind === 'shoot') return threeLine(e.res, e.who.name, e.round, sn(e.who.name))
  if (e.kind === 'cut') {
    const t = e.tie
    const so = t?.rounds?.length ? ` ${andList(t.rounds[0].map(x => sn(x.name)))} tie for the last spot; the shoot-off goes ${t.rounds[t.rounds.length - 1].map(x => `${sn(x.name)} ${x.pts}`).join(', ')}.` : ''
    const me = e.board?.find(x => x.me)
    const miss = me && !e.through.includes(me.name) ? ` ${sn(me.name)} misses the cut with ${me.pts}.` : ''
    return `${andList(e.through.map(sn))} go through to the final.${so}${miss}`
  }
  if (e.kind === 'champ') {
    const t = e.tie
    const so = t?.rounds?.length ? ` It took a 30-second shoot-off: ${t.rounds[t.rounds.length - 1].map(x => `${sn(x.name)} ${x.pts}`).join(', ')}.` : ''
    const fl = P?.standings ? finishLine(P.standings, P.field.find(x => x.me)?.name, sn) : ''
    return `${e.who.name} wins the 3-Point Contest with ${e.res.points} in the final.${so}${fl ? ` ${fl}` : ''}`
  }
  return ''
}
function ThreeContest({ c, setCareer, face, onNext }) {
  const P = useMemo(() => threePlan(c), [c.active.asw.three]) // eslint-disable-line react-hooks/exhaustive-deps
  const sn = useMemo(() => shortNamer(P.field), [P])
  const mine = c.active.asw.three?.mine ?? []
  const lastMe = P.ev.reduce((k, e, i) => (e.kind === 'shoot' && e.me ? i + 1 : k), 0)
  const R = useReveal(P.ev, mine.length ? lastMe : 0, THREE_PACE)
  const [rack, setRack] = useState(4)
  const [playing, setPlaying] = useState(null)
  const mode = gamesMode(c), live = mode !== 'off' && !!engineFor('three-contest')
  const cheered = useRef(false)
  const e = R.cur
  const round = e?.round === 'final' ? 'final' : 'r1'
  const men = round === 'final' ? (P.finalists ?? []) : P.field
  const scores = new Map(P.ev.slice(0, R.shown).filter(x => x.kind === 'shoot' && x.round === round).map(x => [x.who.name, x.res.points]))
  const through = P.ev.slice(0, R.shown).find(x => x.kind === 'cut')?.through ?? null
  // (the final: each man's first round under his name)
  const subs = round === 'final' && P.r1 ? new Map(P.r1.map(x => [x.name, `1ST RD ${x.pts}`])) : null
  const rows = boardRows(men, scores, e?.kind === 'shoot' ? e.who.name : null, round === 'r1' ? through : null, subs)
  const champ = e?.kind === 'champ'
  useEffect(() => {
    if (e?.kind === 'champ' && e.who.me && !cheered.current) { cheered.current = true; victory({ big: true }); haptic('success') }
    else if (e?.kind === 'shoot' && e.me) sfx(e.res.points >= 24 ? 'claim' : 'pop')
  }, [R.shown]) // eslint-disable-line react-hooks/exhaustive-deps
  const shoot = () => {
    const need = P.need
    sfx('whistle')
    if (!live) { setCareer(recordThree(c, simThreeFor(c, rack, need.round), rack, true)); return }
    setCareer(markLive(c, 'three', { round: need.round, rack }))
    setPlaying({ round: need.round, rack, toBeat: need.toBeat })
  }
  const done = res => { const p = playing; setPlaying(null); setCareer(recordThree(c, res?.raw ?? { points: 0, made: 0 }, p.rack)) }
  if (playing) return <Stage c={c} game="three-contest" v={threeV(c)} seed={`${c.seed}-asw3-${c.year}-${playing.round}`} def={{ title: '3-POINT CONTEST', moneyRack: playing.rack, round: playing.round === 'final' ? 'final' : 'first', label: c.name, toBeat: playing.toBeat }} onDone={done} />
  if (R.shown === 0) return (
    <div className="ag-card asw-card ag-pop">
      <span className="ag-eyebrow">ALL-STAR SATURDAY · 3-POINT CONTEST · THE FIELD</span>
      <h3 className="asw-title">Eight shooters</h3>
      <p className="cr-note">Five racks of five around the arc, four balls worth a point and a two-point money ball on each; one rack, his pick, is all money balls. Two deep shots worth three. The top three go to the final.</p>
      <Board rows={P.field} face={face} title="THE SHOOTERS" sn={sn} bare />
      <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { R.setShown(1); sfx('whistle') }}>TO THE FLOOR <IconArrow size={16} /></button>
    </div>
  )
  const need = R.at && e?.kind === 'turn' ? P.need : null
  return (
    <div className="ag-card asw-card ag-pop">
      <span className="ag-eyebrow">ALL-STAR SATURDAY · 3-POINT CONTEST · {round === 'final' ? 'FINAL' : 'FIRST ROUND'}</span>
      {champ && P.standings ? <Standings rows={P.standings} face={face} sn={sn} />
        : <Board rows={rows} face={face} through={round === 'r1' ? through : null} title={round === 'final' ? 'THE FINAL' : 'FIRST ROUND · TOP 3 GO THROUGH'} sn={sn} />}
      {e && e.kind !== 'turn' && (
        <div key={R.shown} className={`asw-call${e.me ? ' is-me' : ''}${e.kind === 'champ' ? ' is-champ' : ''}`}>
          {e.kind === 'shoot' && <span className="asw-call-pts">{e.res.points}</span>}
          {e.kind === 'champ' && <span className="asw-call-pts is-gold"><IconTrophy size={26} /></span>}
          <p>{threeEvText(e, sn, P)}</p>
        </div>
      )}
      {need && (
        <div className="asw-turn">
          <span className="ag-eyebrow">{need.label} · {c.name.toUpperCase()} SHOOTS</span>
          <h3 className="asw-title">Pick the money rack</h3>
          <p className="cr-note">{need.round === 'final' ? (need.toBeat != null ? `${need.toBeat} is the score to beat for the title.` : 'He shoots first in the final. Set the number.') : need.toBeat != null ? `Third place has ${need.toBeat}. ${need.toBeat + 1} puts him in the final outright; a tie means a shoot-off.` : rows[0]?.v != null ? `${sn(rows[0].name)} leads with ${rows[0].v}. The top three go to the final.` : 'He shoots first. Set the number.'}</p>
          <RackPick value={rack} onPick={i => { setRack(i); sfx('tap') }} />
          <button className="ag-btn ag-btn--gold tk-intro-go" onClick={shoot}>SHOOT · MONEY RACK {RACKS[rack]} <IconArrow size={16} /></button>
          {live ? <button className="ag-btn ag-btn--ghost asw-skip" onClick={() => { sfx('tap'); setCareer(recordThree(c, simThreeFor(c, rack, need.round), rack, true)) }}>SKIP · SIMULATE HIS ROUND</button>
            : <small className="asw-sim">Mini Games are off: his round is simulated from his Jump Shot.</small>}
        </div>
      )}
      {!need && e?.kind !== 'champ' && R.shown < P.ev.length && <button className="ag-btn ag-btn--ghost asw-skip" onClick={R.skip}>SKIP AHEAD</button>}
      {e?.kind === 'champ' && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={onNext}>{onNext.label} <IconArrow size={16} /></button>}
    </div>
  )
}
// the five racks, around the arc as they sit on the floor
function RackPick({ value, onPick }) {
  // (spots on a half-court arc: corners low, the top of the key high)
  const at = [[8, 78], [22, 34], [50, 14], [78, 34], [92, 78]]
  return (
    <div className="asw-arc" role="radiogroup" aria-label="Money rack">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M2 96 L2 70 Q50 -18 98 70 L98 96" /><rect x="36" y="64" width="28" height="36" /></svg>
      {at.map(([x, y], i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} className={`asw-rack${value === i ? ' is-on' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => onPick(i)}>
          <i>{[0, 1, 2, 3, 4].map(b => <em key={b} className={value === i || b === 4 ? 'is-money' : ''} />)}</i>
          <small>{RACKS[i]}</small>
        </button>
      ))}
    </div>
  )
}

// ════ The Slam Dunk Contest ════
const DUNK_PACE = e => (e.kind === 'dunk' ? 1100 + 5 * 380 + 1500 : e.kind === 'cut' ? 3200 : 1100)
function dunkEvText(e, sn, P = null) {
  if (e.kind === 'round') return e.round === 'final' ? 'The final: two dunks each, the scores start over.' : e.round.includes('off') ? `${andList(e.tie.map(sn))} are tied. A dunk-off decides it: one dunk each.` : 'Four dunkers, two dunks each. The top two go to the final.'
  if (e.kind === 'dunk') return dunkLine(e, e.who.name, sn(e.who.name))
  if (e.kind === 'cut') {
    const me = e.board?.find(x => x.me)
    return `${andList(e.through.map(sn))} move on to the final.${me && !e.through.includes(me.name) ? ` ${sn(me.name)} goes out with ${me.sum}.` : ''}`
  }
  if (e.kind === 'champ') {
    const fl = P?.standings ? finishLine(P.standings, P.field.find(x => x.me)?.name, sn) : ''
    return `${e.who.name} wins the Slam Dunk Contest, ${e.who.sum} in the final.${fl ? ` ${fl}` : ''}`
  }
  return ''
}
// the five judges' cards, turned over one at a time
function Judges({ x, instant, onUp }) {
  const [n, setN] = useState(instant ? 5 : 0)
  useEffect(() => {
    if (n >= 5) return
    const t = setTimeout(() => { setN(k => k + 1); sfx('tap') }, n === 0 ? 900 : 380)
    return () => clearTimeout(t)
  }, [n])
  useEffect(() => { if (n === 5) { onUp?.(); if (x.perfect && !instant) { sfx('chime'); haptic('success') } } }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="asw-judges" aria-label={`Judges: ${x.cards.join(', ')}`}>
      {x.cards.map((v, i) => <span key={i} className={`asw-judge${i < n ? ' is-up' : ''}${v === 10 ? ' is-ten' : ''}`}>{i < n ? v : ''}</span>)}
      <span className={`asw-judge-total${n >= 5 ? ' is-up' : ''}${x.perfect ? ' is-fifty' : ''}`}>{n >= 5 ? x.total : ''}</span>
    </div>
  )
}
// what his next dunk needs (a dunk scores 30 even with nothing down, 50 at most, so the number only means something
// between the two)
// (still: the men with a dunk to come after his, who can pass him yet)
function dunkNeedText(need, still = []) {
  const fin = need.round.startsWith('final'), where = fin ? 'in front' : 'into the top two', t = need.toBeat
  const yet = still.length ? ` ${andList(still)} ${still.length > 1 ? 'have' : 'has'} a dunk to come.` : ''
  if (t > 50) return `Even a 50 can't move him ${where}.`
  if (t > 30) return `He needs ${t} on this one to move ${where}.${yet}`
  if (t > 0 && need.n === 2) return `Any score puts him ${fin ? 'in front' : 'in the top two'}${still.length ? ' for now' : ''}.${yet}`
  if (t === 0 && need.n === 2) return fin ? 'He is in front. Another good one puts it away.' : 'He is in the top two. Another good one keeps him there.'
  return 'The harder the dunk, the higher it scores if it goes down. Every miss before it lands costs about a point from each judge.'
}
const Tries = ({ tries }) => <span className="asw-tries">{Array.from({ length: DUNK_TRIES }, (_, i) => <i key={i} className={i < tries.length ? (tries[i].landed ? 'is-land' : 'is-miss') : ''}>{i < tries.length ? (tries[i].landed ? 'MADE' : 'MISS') : ''}</i>)}</span>
const Tier = ({ t }) => <b className={`asw-tier is-${t}`}>{TIER_WORD[t] ?? 'MEDIUM'}</b>
// The dunk is called in the game, on the board on the court (lib/mg/dunkcontest.js). A dunk simulated (Mini Games OFF,
// or SKIP) is called for him: the hard ones once his Bounce and Finishing are up to them or he needs a big one, the
// medium ones otherwise, never one he's already landed tonight
function autoDunk(c, need) {
  const used = new Set(need?.used ?? [])
  const tier = dunkV(c) >= 10 || (need?.toBeat ?? 0) > 46 ? 'hard' : 'medium'
  return (DUNKS.find(d => tierOf(d) === tier && !used.has(d.id)) ?? DUNKS.find(d => !used.has(d.id)) ?? DUNKS[0]).id
}

function DunkContest({ c, setCareer, face, onNext }) {
  const P = useMemo(() => dunkPlan(c), [c.active.asw.dunk]) // eslint-disable-line react-hooks/exhaustive-deps
  const sn = useMemo(() => shortNamer(P.field), [P])
  const W = c.active.asw.dunk ?? {}
  const mine = W.mine ?? []
  const lastMe = P.ev.reduce((k, e, i) => (e.kind === 'dunk' && e.me ? i + 1 : k), 0)
  const R = useReveal(P.ev, mine.length || W.cur ? Math.max(1, lastMe || P.ev.length) : 0, DUNK_PACE)
  const [playing, setPlaying] = useState(null)
  const lastCall = useRef(null)   // (the board opens on the dunk he called last)
  // (the season as it is now: the game books a missed try while it's still up, so its handlers never work off the
  // one it opened on)
  const cNow = useRef(c); cNow.current = c
  const setNow = useRef(setCareer); setNow.current = setCareer
  const put = n => { cNow.current = n; setNow.current(n) }
  const mode = gamesMode(c), live = mode !== 'off' && !!engineFor('dunk-contest')
  const cheered = useRef(false)
  const e = R.cur
  const roundOf = ev => (ev?.round === 'final' || ev?.round?.startsWith('final') ? 'final' : 'r1')
  const round = roundOf(e)
  const men = round === 'final' ? (P.finalists ?? P.field.filter(m => P.ev.find(x => x.kind === 'cut')?.through?.includes(m.name))) : P.field
  // (the dunk on the floor counts on the board once the last judge's card is up)
  const [judged, setJudged] = useState(0)
  const pending = e?.kind === 'dunk' && judged !== R.shown
  const evs = P.ev.slice(0, pending ? R.shown - 1 : R.shown)
  const scores = new Map(), subs = new Map()
  for (const x of evs) if (x.kind === 'dunk' && roundOf(x) === round && !x.round.includes('off')) { scores.set(x.who.name, (scores.get(x.who.name) ?? 0) + x.total); subs.set(x.who.name, [...(subs.get(x.who.name) ?? []), x.total]) }
  const cnt = new Map([...subs].map(([k, v]) => [k, v.length]))
  for (const [k, v] of subs) subs.set(k, v.join(' + '))
  const through = evs.find(x => x.kind === 'cut')?.through ?? null
  const rows = boardRows(men, scores, e?.kind === 'dunk' ? e.who.name : null, round === 'r1' ? through : null, subs)
  const champ = e?.kind === 'champ'
  useEffect(() => {
    if (e?.kind === 'champ' && e.who.me && !cheered.current) { cheered.current = true; victory({ big: true }); haptic('success') }
  }, [R.shown]) // eslint-disable-line react-hooks/exhaustive-deps
  const need = R.at && e?.kind === 'turn' ? P.need : null
  const cur = W.cur
  const attempt = (cur?.tries?.length ?? 0) + 1
  // (the first try: he calls the dunk in the game; the live mark gets the dunk as he calls it, so a game left after
  // the call is a miss on that dunk, and one left before it is nothing)
  const go = () => {
    if (!live) { sfx('whistle'); setCareer(simDunkFor(c, autoDunk(c, need), `${need.round}-${need.n}`)); return }
    sfx('tap')
    const c1 = markLive(c, 'dunk', { dunk: null })
    setCareer(c1)
    setPlaying({ dunk: null, attempt, round: need.round, n: need.n, used: need.used, toBeat: need.toBeat, c1 })
  }
  const again = () => { setCareer(markLive(c, 'dunk', { dunk: cur.dunk })); setPlaying({ dunk: cur.dunk, attempt, round: need.round, n: need.n, toBeat: need.toBeat }); sfx('whistle') }
  // a try missed with tries left, in the game: booked at once, and the next try marked live (the game goes on to it:
  // the call, he walks back, the next try's card)
  const missed = res => {
    const id = res?.raw?.dunk
    if (!id) return
    lastCall.current = id
    put(markLive(recordAttempt(cNow.current, id, res.raw), 'dunk', { dunk: id }))
  }
  const done = res => {
    const p = playing; setPlaying(null)
    const id = res?.raw?.dunk ?? p.dunk
    if (!id) return
    lastCall.current = id
    put(recordAttempt(cNow.current, id, res?.raw ?? { landed: false, quality: 0.2 }))
    sfx(res?.raw?.landed ? 'claim' : 'deny')
  }
  if (playing) {
    // (every try at the dunk is played in the one game: the card before each, the miss called, the walk back)
    const needs = playing.toBeat > 30 && playing.toBeat <= 50 ? playing.toBeat : null
    const def = playing.dunk
      ? { title: 'SLAM DUNK CONTEST', dunk: playing.dunk, lock: true, attempt: playing.attempt, tries: DUNK_TRIES, label: c.name, need: needs, onTry: missed }
      : { title: 'SLAM DUNK CONTEST', dunk: lastCall.current, used: playing.used, attempt: 1, tries: DUNK_TRIES, label: c.name, need: needs, onTry: missed,
        onPick: id => put(markLive(playing.c1, 'dunk', { dunk: id })) }
    return <Stage c={c} game="dunk-contest" v={dunkV(c)} seed={`${c.seed}-aswd-${c.year}-${playing.round}-${playing.n}-${playing.attempt}`} def={def} onDone={done} />
  }
  if (R.shown === 0) return (
    <div className="ag-card asw-card ag-pop">
      <span className="ag-eyebrow">ALL-STAR SATURDAY · SLAM DUNK CONTEST · THE FIELD</span>
      <h3 className="asw-title">Four dunkers</h3>
      <p className="cr-note">Two dunks each in the first round, three tries to land each one. Five judges score every dunk from 6 to 10. The top two go to the final, two more dunks, the best total wins.</p>
      <Board rows={P.field} face={face} title="THE DUNKERS" sn={sn} bare />
      <button className="ag-btn ag-btn--gold tk-intro-go" onClick={() => { R.setShown(1); sfx('whistle') }}>TO THE FLOOR <IconArrow size={16} /></button>
    </div>
  )
  return (
    <div className="ag-card asw-card ag-pop">
      <span className="ag-eyebrow">ALL-STAR SATURDAY · SLAM DUNK CONTEST · {round === 'final' ? 'FINAL' : 'FIRST ROUND'}</span>
      {champ && P.standings ? <Standings rows={P.standings} face={face} sn={sn} dunk />
        : <Board rows={rows} face={face} through={round === 'r1' ? through : null} title={round === 'final' ? 'THE FINAL · TWO DUNKS' : 'FIRST ROUND · TOP 2 GO THROUGH'} sn={sn} />}
      {e && e.kind === 'dunk' && (
        <div key={R.shown} className={`asw-dunk${e.me ? ' is-me' : ''}`}>
          <div className="asw-dunk-top"><span className="asw-dunk-who">{e.me ? e.who.name : sn(e.who.name)}</span><Tier t={e.tier} /><Tries tries={e.tries} /></div>
          <b className="asw-dunk-name">{e.dunk.name}</b>
          <Judges x={e} instant={reducedMotion()} onUp={() => setJudged(R.shown)} />
          <p className={`asw-dunk-line${pending ? ' is-wait' : ''}`}>{pending ? `${e.tries.length === 1 ? 'First try' : e.tries.length === 2 ? 'Second try' : 'Third try'}. The judges have it.` : dunkEvText(e, sn)}</p>
        </div>
      )}
      {e && (e.kind === 'round' || e.kind === 'cut' || e.kind === 'champ') && (
        <div key={R.shown} className={`asw-call${e.kind === 'champ' ? ' is-champ' : ''}${e.kind === 'champ' && e.who.me ? ' is-me' : ''}`}>
          {e.kind === 'champ' && <span className="asw-call-pts is-gold"><IconTrophy size={26} /></span>}
          <p>{dunkEvText(e, sn, P)}</p>
        </div>
      )}
      {need && !cur && (
        <div className="asw-turn">
          <span className="ag-eyebrow">{need.label} · DUNK {need.round.includes('off') ? '' : `${need.n} OF 2 · `}{c.name.toUpperCase()}</span>
          <h3 className="asw-title">{`${c.name} is up`}</h3>
          <p className="cr-note">{dunkNeedText(need, need.round.includes('off') ? [] : men.filter(m => !m.me && (cnt.get(m.name) ?? 0) < need.n).map(m => sn(m.name)))}</p>
          <button className="ag-btn ag-btn--gold tk-intro-go" onClick={go}>{live ? 'TO THE FLOOR' : 'SIMULATE THE DUNK'} <IconArrow size={16} /></button>
          {live ? <button className="ag-btn ag-btn--ghost asw-skip" onClick={() => { sfx('tap'); setCareer(simDunkFor(c, autoDunk(c, need), `${need.round}-${need.n}`)) }}>SKIP · SIMULATE THE DUNK</button>
            : <small className="asw-sim">Mini Games are off: his dunks are called and simulated from his Bounce and Finishing.</small>}
        </div>
      )}
      {need && cur && (
        <div className="asw-turn">
          <span className="ag-eyebrow">{need.label} · {dunkById(cur.dunk)?.name.toUpperCase()}</span>
          <div className="asw-dunk-top"><Tier t={tierOf(dunkById(cur.dunk))} /><Tries tries={cur.tries} /></div>
          <h3 className="asw-title">{cur.tries.length === 1 ? 'Off the rim. Two tries left.' : 'Missed again. One try left.'}</h3>
          <p className="cr-note">{cur.tries.length === 1 ? 'Land it now and the judges take about a point each off what it would have scored.' : 'Nothing down in three and the judges score his best try, low 30s.'}</p>
          <button className="ag-btn ag-btn--gold tk-intro-go" onClick={again}>ATTEMPT {attempt} OF {DUNK_TRIES} <IconArrow size={16} /></button>
          <button className="ag-btn ag-btn--ghost asw-skip" onClick={() => { sfx('tap'); setCareer(simDunkFor(c, cur.dunk, `${need.round}-${need.n}`)) }}>SKIP · SIMULATE THE TRIES LEFT</button>
        </div>
      )}
      {!need && e?.kind !== 'champ' && R.shown < P.ev.length && <button className="ag-btn ag-btn--ghost asw-skip" onClick={R.skip}>SKIP AHEAD</button>}
      {e?.kind === 'champ' && <button className="ag-btn ag-btn--gold tk-intro-go" onClick={onNext}>{onNext.label} <IconArrow size={16} /></button>}
    </div>
  )
}

// ════ The night, in order ════
export default function AllStarSaturday({ c, setCareer, getD, face }) {
  const w = c.active.asw
  // (a game left before it finished, a reload or a closed app: counted the Career way, then the night goes on)
  const boot = useRef(!!(w.three?.live || w.dunk?.live))
  useEffect(() => { if (boot.current) { boot.current = false; setCareer(settleLive(c)) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!w.pick) return <AllStarInvite c={c} setCareer={setCareer} getD={getD} />
  if (boot.current) return null
  const toDunks = w.pick.dunk && !w.dunkOn
  const finish = () => { setCareer(finishAllStar(c)); unlockAllStar(); sfx('complete') }
  if (w.pick.three && !w.threeSeen) {
    const next = Object.assign(() => { if (toDunks) { setCareer({ ...c, active: { ...c.active, asw: { ...w, threeSeen: true, dunkOn: true } } }); sfx('whistle') } else finish() }, { label: toDunks ? 'ON TO THE DUNK CONTEST' : 'BACK TO THE SEASON' })
    return <ThreeContest key="three" c={c} setCareer={setCareer} face={face} onNext={next} />
  }
  if (w.pick.dunk) return <DunkContest key="dunk" c={c} setCareer={setCareer} face={face} onNext={Object.assign(finish, { label: 'BACK TO THE SEASON' })} />
  return null
}

// How the night went, on the hub until the next run of games
export function AllStarResult({ c }) {
  const res = c.active.asw.res ?? {}
  const rows = [
    res.three && { k: '3-POINT CONTEST', won: res.three.won, head: res.three.won ? '3-Point Contest champion' : res.three.place ? `${ord(res.three.place)} in the 3-Point Contest` : 'Out in the first round', sub: res.three.won ? `${res.three.r1} in the first round, ${res.three.final} in the final.` : `${res.three.r1} in the first round${res.three.final != null ? `, ${res.three.final} in the final` : ''}. ${res.three.champ} won it with ${res.three.champPts}.` },
    res.dunk && { k: 'SLAM DUNK CONTEST', won: res.dunk.won, head: res.dunk.won ? 'Slam Dunk champion' : res.dunk.final != null ? 'Runner-up in the Dunk Contest' : res.dunk.place ? `${ord(res.dunk.place)} in the Dunk Contest` : 'Out in the first round', sub: `${res.dunk.best ? `Best dunk: the ${res.dunk.best.name}, ${res.dunk.best.total}. ` : ''}${res.dunk.won ? `${res.dunk.final} in the final.` : `${res.dunk.champ} won it with ${res.dunk.champPts} in the final.`}` },
  ].filter(Boolean)
  if (!rows.length) return null
  return (
    <div className="ag-card asw-done ag-pop">
      <span className="ag-eyebrow">GAME {c.active.asw.at} · ALL-STAR SATURDAY</span>
      {rows.map(r => (
        <div key={r.k} className={`asw-done-row${r.won ? ' is-won' : ''}`}>
          {r.won && <IconTrophy size={18} />}
          <span><small>{r.k}{r.won ? ` · +${ASW_LEGACY} LEGACY` : ''}</small><b>{r.head}</b><em>{r.sub}</em></span>
        </div>
      ))}
    </div>
  )
}
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

// ════ Practice (MiniGameLab): one contest, the whole night of it ════
// The Career contest itself, on a stand-in career that only lives on this screen: the league's real field for the
// night (threeField / dunkField), every rival's round simulated the same way, his rounds played on the stage at the
// grade picked, through the final to the standings. Nothing is kept. GO AGAIN draws a new field.
const PRACTICE_NAME = { 'three-contest': '3-Point Contest', 'dunk-contest': 'Slam Dunk Contest' }
function practiceCareer(game, v, name, team) {
  const three = game === 'three-contest'
  return {
    sport: 'bucket', seed: `practice-asw-${Math.random().toString(36).slice(2, 10)}`, year: 0, season: 2026, name, owner: name, pos: 'guard',
    team: team?.short ?? '', fit: team ?? null, games: 'advanced', roster: null, gone: [],
    build: { jumpShot: { val: v }, finishing: { val: v }, bounce: { val: v } },
    active: { k: 0, feed: [], asw: { at: 0, inv: { three, dunk: !three }, pick: { three, dunk: !three }, three: three ? { mine: [] } : null, dunk: three ? null : { mine: [] }, done: false } },
  }
}
export function PracticeContest({ game, v, team, name, onBack }) {
  const [run, setRun] = useState(0)
  const [c, setC] = useState(() => practiceCareer(game, v, name, team))
  const again = Object.assign(() => { setC(practiceCareer(game, v, name, team)); setRun(n => n + 1); sfx('tap') }, { label: 'GO AGAIN' })
  const Contest = game === 'three-contest' ? ThreeContest : DunkContest
  return (
    <div className="ag-screen pr-screen asw-practice">
      <div className="pr-wrap">
        <header className="pr-top">
          <h1 className="ag-h1">{PRACTICE_NAME[game]}</h1>
          <button className="ag-round-btn" onClick={onBack} aria-label="Back to Practice"><IconClose size={16} /></button>
        </header>
        <Contest key={run} c={c} setCareer={setC} face={<b>{initials(name)}</b>} onNext={again} />
      </div>
    </div>
  )
}
