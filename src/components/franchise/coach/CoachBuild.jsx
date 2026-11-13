import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FrShell, Bug, Logo, Confirm, useWide } from '../frUi'
import { teamOf } from '../frTeams'
import { cleanName } from '../frStore'
import { seededShuffle, seededTeamOrder } from '../../../lib/rng'
import { valToGrade } from '../../../utils/simulation'
import { randomName } from '../../../lib/playerNames'
import { sfx, haptic } from '../../../lib/juice'
import { IconSpin } from '../../app/icons'
import './coach.css'
import { spectrumColor } from '../../../lib/gradeColors'

// FRANCHISE: BUILD THE COACH (DESIGN.md section 8). The game's own build mechanic for a head coach, on its own
// screen: no figure. SPIN lands on a team's staff, then on one man from it (the head coach or a coordinator); take
// ONE of his five ratings into the matching line of the call sheet; five spins fill the five lines.
//
//   props   team: the GM's team (short) · onDone(coach | null): null keeps the team's real head coach · onBack()
//   coach   { name, build, ovr, identity }
//           build: { talentDev, offPlaycalling, defPlaycalling, culture, situational }, each the game's build slot
//           { type, val (0-11), qbFull (the coach it came from), team (his team), role ('HC' | 'OC' | 'DC') }
//           (lib/franchise createFranchise / hireBuiltCoach read name and build; ovr and identity are for a screen)
//
// The spins are seeded exactly as a player build's are (components/SpinScreen.jsx): a seed per build, spin #n lands
// on the nth staff of the seed's order and on the first man of that staff's own order; a respin is its own draw and
// never lands where it started. The build is kept for the tab (sessionStorage), so BACK or a reload in the middle
// of a spin deals the same coach again.
// Respins are the players' rule as the game has it: one of the staff and one of the coach A BUILD.
const RESPIN_EVERY_SPIN = false   // true: both come back with every spin

const TYPES = ['talentDev', 'offPlaycalling', 'defPlaycalling', 'culture', 'situational']
const LABEL = { talentDev: 'TALENT DEVELOPMENT', offPlaycalling: 'OFFENSIVE PLAYCALLING', defPlaycalling: 'DEFENSIVE PLAYCALLING', culture: 'CULTURE BUILDING', situational: 'SITUATIONAL AWARENESS' }
const JOB = { HC: 'HEAD COACH', OC: 'OFFENSIVE COORDINATOR', DC: 'DEFENSIVE COORDINATOR' }
const JOBS = ['HC', 'OC', 'DC'].map(role => ({ role, name: null }))   // the coach wheel before a staff is on it
const ORDER = { HC: 0, OC: 1, DC: 2 }
const KEY = 'bap_fr_coach_build'

// the real staffs (src/data/nfl-coaches.js): picked up when the file is in the repo, an empty list when it isn't
const DATA = import.meta.glob('../../../data/nfl-coaches.js')
const loadCoaches = Object.values(DATA)[0] ?? null

// the letter's colour, as the build screen has it (SpinScreen.jsx gradeColor)
const gradeColor = spectrumColor   // one shade a step (lib/gradeColors.js)
// A head coach's one number: the data file's own formula (nfl-coaches.js header), so a built coach reads on the
// same scale as the real ones on the wheel. A line still open counts as the average of the lines that are in
// (lib/franchise builtCoachRow fills it the same way).
function ovrOf(slots) {
  const vals = TYPES.map(t => slots[t]?.val).filter(v => typeof v === 'number')
  if (!vals.length) return null
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  const a = Object.fromEntries(TYPES.map(t => [t, Math.max(0, Math.min(11, Math.round(typeof slots[t]?.val === 'number' ? slots[t].val : avg)))]))
  const hi = Math.max(a.offPlaycalling, a.defPlaycalling), lo = Math.min(a.offPlaycalling, a.defPlaycalling)
  return Math.round(46 + 5.1 * (0.26 * a.culture + 0.22 * a.situational + 0.18 * a.talentDev + 0.24 * hi + 0.10 * lo))
}
// who he is, from his two strongest ratings
const ONE = { talentDev: 'Talent developer', offPlaycalling: 'Offensive play-caller', defPlaycalling: 'Defensive play-caller', culture: 'Culture builder', situational: 'Game manager' }
const TWO = {
  'offPlaycalling+defPlaycalling': 'Calls both sides of the ball', 'offPlaycalling+talentDev': 'Offensive play-caller, developer of quarterbacks',
  'offPlaycalling+culture': "Offensive play-caller, players' coach", 'offPlaycalling+situational': 'Offensive play-caller, sharp on game day',
  'defPlaycalling+offPlaycalling': 'Calls both sides of the ball', 'defPlaycalling+talentDev': 'Defensive play-caller, developer of young talent',
  'defPlaycalling+culture': 'Defensive play-caller, leader of men', 'defPlaycalling+situational': 'Defensive play-caller, sharp on game day',
  'talentDev+offPlaycalling': 'Developer of quarterbacks', 'talentDev+defPlaycalling': 'Developer of defensive talent',
  'talentDev+culture': 'Program builder', 'talentDev+situational': 'Teacher and game manager',
  'culture+offPlaycalling': 'Culture builder with an offensive background', 'culture+defPlaycalling': 'Culture builder with a defensive background',
  'culture+talentDev': 'Program builder', 'culture+situational': 'CEO head coach',
  'situational+offPlaycalling': 'Game manager with an offensive background', 'situational+defPlaycalling': 'Game manager with a defensive background',
  'situational+talentDev': 'Game manager and teacher', 'situational+culture': 'CEO head coach',
}
function identityOf(slots) {
  const top = TYPES.filter(t => slots[t]).sort((a, b) => slots[b].val - slots[a].val)
  if (!top.length) return null
  return top.length === 1 ? ONE[top[0]] : TWO[`${top[0]}+${top[1]}`] ?? ONE[top[0]]
}
const tierOf = ovr => (ovr >= 92 ? 4 : ovr >= 87 ? 3 : ovr >= 82 ? 2 : ovr >= 76 ? 1 : 0)
const lastOf = name => { const p = String(name || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').split(' '); return p[p.length - 1] || name }
const reduced = () => document.documentElement.classList.contains('bap-reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const newSeed = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const fresh = (team, name = randomName()) => ({ v: 1, team, seed: newSeed(), n: 0, slots: {}, name, tr: 0, cr: 0, cur: null })
function saved(team) {
  try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && s.v === 1 && s.team === team && s.seed && s.slots ? s : null } catch { return null }
}

// a number that counts to its value from where it stood (from 0 when `from0` changes: the finished build's count)
function useCount(target, from0 = 0) {
  const [v, setV] = useState(target ?? 0)
  const at = useRef(target ?? 0), key = useRef(from0)
  useEffect(() => {
    const to = target ?? 0
    const from = key.current !== from0 ? 0 : at.current
    const ms = key.current !== from0 ? 950 : 520
    key.current = from0
    if (reduced() || from === to) { at.current = to; setV(to); return }
    let raf, t0
    const step = now => {
      t0 ??= now
      const t = Math.min(1, (now - t0) / ms)
      at.current = Math.round(from + (to - from) * (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)))
      setV(at.current)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, from0])
  return v
}

// ── a wheel ─────────────────────────────────────────────────────────────────
// The build screen's reel, by its own numbers (SpinScreen.jsx: full speed for the first 45% of the spin, then an
// S-curve down to the row it was dealt), as one GPU animation: nothing runs on the page while it turns. It rests
// when it isn't spinning (no idle drift). Reduce Motion: it's on its row at once.
//   items + idOf + row(item) · target: the id it lands on · run: a count, a change starts a spin · at: the id it
//   rests on when it first shows · h: a row's height · three rows show, the middle one is the wheel's answer
const FAST_MS = 36, KICK = 0.45, AREA = KICK + (1 - KICK) * 0.5
const ease = t => { if (t < KICK) return t / AREA; const u = (t - KICK) / (1 - KICK); return (KICK + (1 - KICK) * (u - u * u * u + (u * u * u * u) / 2)) / AREA }
function Reel({ items, idOf, row, target, run, at = null, ms, h, onStop, state }) {
  const len = items.length
  const travel = Math.ceil((ms / FAST_MS) * AREA)
  const copies = Math.ceil((travel + len + 4) / len) + 2
  const rows = useMemo(() => Array.from({ length: copies }, () => items).flat().map((it, i) => <div key={i} className="cb-reel-row">{row(it)}</div>), [items, copies]) // eslint-disable-line react-hooks/exhaustive-deps
  const track = useRef(null), pos = useRef(0), anim = useRef(null), timer = useRef(0), prev = useRef(null), first = useRef(true)
  const stop = useRef(onStop)
  stop.current = onStop
  const place = () => { if (track.current) track.current.style.transform = `translate3d(0,${-(pos.current - 1) * h}px,0)` }
  useLayoutEffect(() => {
    if (prev.current !== items) {
      prev.current = items
      const i = first.current && at != null ? items.findIndex(x => idOf(x) === at) : 0
      pos.current = len + Math.max(0, i)
    }
    first.current = false
    if (!anim.current) place()
  })
  useEffect(() => {
    if (!run || target == null) return
    const from = len + (((Math.round(pos.current) % len) + len) % len)
    let end = from + travel
    for (let n = 0; n < len && idOf(items[end % len]) !== target; n++) end++
    const done = () => { anim.current = null; pos.current = len + (end % len); place(); timer.current = setTimeout(() => stop.current?.(), 150) }
    const el = track.current
    if (reduced() || !el?.animate) { done(); return () => clearTimeout(timer.current) }
    const N = 32
    const a = el.animate(Array.from({ length: N + 1 }, (_, i) => ({ transform: `translate3d(0,${-(from + (end - from) * ease(i / N) - 1) * h}px,0)` })), { duration: ms, easing: 'linear', fill: 'forwards' })
    anim.current = a
    a.onfinish = () => { a.cancel(); done() }
    return () => { a.onfinish = null; a.cancel(); anim.current = null; clearTimeout(timer.current); place() }
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`cb-reel is-${state}`} style={{ height: h * 3 }}>
      <div className="cb-reel-track" ref={track} style={{ '--cb-h': `${h}px` }}>{rows}</div>
      <i className="cb-reel-mark" />
    </div>
  )
}
const teamRow = t => <><Logo team={t.short} size={28} /><b>{t.nick.toUpperCase()}</b></>
const coachRow = c => (c.name
  ? <><b className={c.name.length > 16 ? 'is-long' : undefined}>{c.name}</b><i>{c.role}</i></>
  : <span>{JOB[c.role]}</span>)

export default function CoachBuild({ team, onDone, onBack }) {
  const wide = useWide()
  const mine = teamOf(team)
  // the staffs: undefined while the file loads, [] when there is none
  const [coaches, setCoaches] = useState(undefined)
  useEffect(() => {
    let on = true
    if (!loadCoaches) { setCoaches([]); return }
    loadCoaches().then(m => { if (on) setCoaches(Array.isArray(m.NFL_COACHES) ? m.NFL_COACHES.filter(c => c && c.name && c.team && c.attrs && ORDER[c.role] != null) : []) }).catch(() => { if (on) setCoaches([]) })
    return () => { on = false }
  }, [])
  const staffs = useMemo(() => {
    const by = {}
    for (const c of coaches ?? []) (by[c.team] ??= []).push(c)
    for (const k in by) by[k].sort((a, b) => ORDER[a.role] - ORDER[b.role])
    return by
  }, [coaches])
  // the staff wheel: every club with a staff on file, in the order a schedule lists them
  const teams = useMemo(() => Object.keys(staffs).sort().map(teamOf), [staffs])
  const realHC = staffs[team]?.find(c => c.role === 'HC') ?? null

  const [S, setS] = useState(() => saved(team) ?? fresh(team))
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(S)) } catch { /* a full or closed store: the build just isn't kept */ } }, [S])
  const filled = TYPES.filter(t => S.slots[t]).length
  // idle → team (the staff wheel turns) → pause → coach (the coach wheel turns) → landed (take one) → idle … → done
  const [phase, setPhase] = useState(() => (filled === TYPES.length ? 'done' : S.cur ? 'landed' : 'idle'))
  const [runT, setRunT] = useState(0), [runC, setRunC] = useState(0)
  const [fast, setFast] = useState(false)
  const [just, setJust] = useState(null)     // the line that was just filled
  const [beat, setBeat] = useState(0)        // the finished build's moment (0: none, or the build was already done)
  const [ask, setAsk] = useState(false)
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const landedTeam = S.cur ? teamOf(S.cur.t) : null
  const landed = S.cur ? staffs[S.cur.t]?.find(c => c.name === S.cur.c) ?? null : null
  const staffUp = S.cur && phase !== 'team' && staffs[S.cur.t]
  const coachItems = staffUp || JOBS
  const busy = phase === 'team' || phase === 'pause' || phase === 'coach'

  // the seeded deals (the build screen's rules)
  const sorted = useMemo(() => [...teams].sort((a, b) => a.short.localeCompare(b.short)), [teams])
  const byName = short => [...(staffs[short] ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const dealtTeam = i => seededTeamOrder(sorted, `${S.seed}:teams`)[i % sorted.length]
  const startTeam = () => { setFast(false); setPhase('team'); setRunT(n => n + 1); sfx('spin') }

  const spin = () => {
    if (busy || phase === 'landed' || phase === 'done' || !sorted.length) return
    sfx('tap'); haptic('medium')
    const i = S.n, t = dealtTeam(i)
    const c = seededShuffle(byName(t.short), `${S.seed}:${i}:${t.short}`)[0]
    setJust(null)
    setS(s => ({ ...s, n: i + 1, cur: { t: t.short, c: c.name, free: false, d: 0 }, ...(RESPIN_EVERY_SPIN ? { tr: 0, cr: 0 } : {}) }))
    startTeam()
  }
  const respinTeam = () => {
    if (phase !== 'landed' || S.tr >= 1) return
    sfx('tap'); haptic('medium')
    const i = S.n - 1, dealt = dealtTeam(i)
    const order = seededTeamOrder(sorted, `${S.seed}:r:teams:${i}`)
    const t = order.find(x => x.short !== dealt.short && x.short !== S.cur.t) ?? order[0]
    const c = seededShuffle(byName(t.short), `${S.seed}:r:${i}:${t.short}`)[0]
    setS(s => ({ ...s, tr: s.tr + 1, cur: { t: t.short, c: c.name, free: true, d: 0 } }))
    startTeam()
  }
  const respinCoach = () => {
    if (phase !== 'landed' || S.cr >= 1) return
    sfx('tap'); haptic('medium')
    const i = S.n - 1, short = S.cur.t, d = S.cur.d + 1
    const own = seededShuffle(byName(short), `${S.seed}:r:${i}:${short}`)
    // (never the man this spin dealt: the same coach again was a wasted respin)
    const rest = own.filter(c => c.name !== S.cur.c)
    const c = S.cur.free ? own[d % own.length] : rest.length ? rest[(d - 1) % rest.length] : own[0]
    setS(s => ({ ...s, cr: s.cr + 1, cur: { ...s.cur, c: c.name, d } }))
    setFast(true); setPhase('coach'); setRunC(n => n + 1); sfx('spin')
  }
  const onTeamStop = useCallback(() => {
    sfx('lock'); haptic('heavy')
    setPhase('pause')
    later(() => { setPhase('coach'); setRunC(n => n + 1); sfx('spin') }, 300)
  }, [])
  const onCoachStop = useCallback(() => { sfx('lock'); haptic('heavy'); setPhase('landed') }, [])

  const take = type => {
    if (phase !== 'landed' || !landed || S.slots[type]) return
    const val = landed.attrs[type]
    sfx('slot'); haptic('medium')
    later(() => sfx('gradepop', val), 90)
    const slots = { ...S.slots, [type]: { type, val, qbFull: landed.name, team: landed.team, role: landed.role } }
    const all = TYPES.every(t => slots[t])
    setS(s => ({ ...s, slots, cur: null }))
    setJust(type)
    if (!all) { setPhase('idle'); return }
    setPhase('done'); setBeat(b => b + 1)
    const ovr = ovrOf(slots)
    later(() => { sfx('complete', tierOf(ovr)); TYPES.forEach((t, k) => later(() => sfx('gradepop', slots[t].val), 180 + k * 75)) }, 260)
    later(() => haptic('heavy'), 1260)
  }
  const startOver = () => { setAsk(false); setJust(null); setBeat(0); setPhase('idle'); setS(s => fresh(team, s.name)) }
  const hire = () => {
    const name = S.name.trim() || randomName()
    try { sessionStorage.removeItem(KEY) } catch { /* nothing kept */ }
    sfx('send'); haptic('medium')
    onDone({ name, build: Object.fromEntries(TYPES.map(t => [t, S.slots[t]])), ovr: ovrOf(S.slots), identity: identityOf(S.slots) })
  }

  const ovr = ovrOf(S.slots)
  const shown = useCount(ovr, beat)
  const identity = identityOf(S.slots)
  const done = phase === 'done'
  const h = wide ? 56 : 44
  const keep = <button className="fr-btn fr-btn--line" onClick={() => { sfx('tap'); onDone(null) }}>{realHC ? `KEEP ${lastOf(realHC.name).toUpperCase()}` : 'KEEP THE HEAD COACH'}</button>
  const bug = <Bug title="BUILD THE COACH" eyebrow={mine.name.toUpperCase()} cells={coaches?.length ? [{ k: 'n', label: 'RATINGS', value: `${filled}/${TYPES.length}` }] : []} onExit={onBack} exit="BACK" />

  if (!coaches?.length) {
    return (
      <FrShell mainKey="coach-build" bug={bug} cta={coaches ? keep : null}>
        <div className="fr-page">{coaches && <section className="fr-panel"><div className="fr-empty">NO COACHING STAFFS ON FILE</div></section>}</div>
      </FrShell>
    )
  }
  const spinWord = phase === 'landed' ? 'TAKE ONE RATING' : 'SPIN'
  const spinOff = busy || phase === 'landed'
  return (
    <FrShell mainKey="coach-build" bug={bug}
      cta={<>{keep}{done ? <button className="fr-btn" onClick={hire}>HIRE HIM</button> : <button className="fr-btn cb-phone" disabled={spinOff} onClick={spin}>{spinWord}</button>}</>}>
      <div className={`fr-page cb${done ? ' is-done' : ''}`}>
        {!done && (
          <div className="cb-left">
            <section className="fr-panel cb-wheels">
              <header className="fr-h"><h2>Spin {Math.min(TYPES.length, S.n + (phase === 'idle' ? 1 : 0))} of {TYPES.length}</h2><small>{phase === 'landed' ? 'TAKE ONE' : busy ? 'SPINNING' : 'READY'}</small></header>
              <div className="cb-reels">
                <div className="cb-reel-col">
                  <div className="cb-reel-h">STAFF</div>
                  <Reel items={teams} idOf={t => t.short} row={teamRow} target={S.cur?.t ?? null} run={runT} at={S.cur?.t ?? team} ms={1500} h={h} onStop={onTeamStop}
                    state={phase === 'team' ? 'spin' : S.cur ? 'lock' : 'rest'} />
                </div>
                <div className="cb-reel-col">
                  <div className="cb-reel-h">COACH</div>
                  <Reel items={coachItems} idOf={c => c.name ?? c.role} row={coachRow} target={staffUp ? S.cur.c : null} run={runC} at={S.cur?.c ?? null} ms={fast ? 900 : 1100} h={h} onStop={onCoachStop}
                    state={phase === 'coach' ? 'spin' : phase === 'landed' ? 'lock' : staffUp ? 'rest' : 'wait'} />
                </div>
              </div>
              <div className="cb-respins">
                <button disabled={phase !== 'landed' || S.tr >= 1} onClick={respinTeam}>RESPIN STAFF<i>{Math.max(0, 1 - S.tr)}</i></button>
                <button disabled={phase !== 'landed' || S.cr >= 1} onClick={respinCoach}>RESPIN COACH<i>{Math.max(0, 1 - S.cr)}</i></button>
              </div>
            </section>
            <button className="fr-btn fr-btn--wide cb-wide cb-spin" disabled={spinOff} onClick={spin}>{spinWord}</button>
            {phase === 'landed' && landed && (
              <section className="fr-panel cb-landed" aria-label={`${landed.name}, ${JOB[landed.role]}, ${landedTeam.name}`}>
                <div className="cb-who">
                  <span className="cb-plate"><Logo team={landed.team} size={36} /></span>
                  <span className="cb-who-main"><b>{landed.name}</b><small>{JOB[landed.role]} · {landedTeam.nick.toUpperCase()}</small></span>
                  {landed.ovr != null && <span className="cb-who-ovr"><b>{landed.ovr}</b><small>OVR</small></span>}
                </div>
                {TYPES.map(t => {
                  const v = landed.attrs[t], has = S.slots[t]
                  return (
                    <button key={t} className="cb-take" disabled={!!has} onClick={() => take(t)} aria-label={`${LABEL[t]}, ${valToGrade(v)}${has ? ', already on the call sheet' : ', take it'}`}>
                      <span>{LABEL[t]}</span>
                      {has ? <small>FILLED</small> : <small className="cb-take-go">TAKE</small>}
                      <b style={{ color: gradeColor(v) }}>{valToGrade(v)}</b>
                    </button>
                  )
                })}
              </section>
            )}
          </div>
        )}
        <section className={`fr-panel cb-card${done ? ' is-done' : ''}${beat ? ' is-beat' : ''}`} key={beat}>
          <header className="fr-h"><h2>Head coach</h2><small>{done ? 'CALL SHEET COMPLETE' : mine.nick.toUpperCase()}</small></header>
          <div className="cb-id">
            <div className="cb-id-main">
              <span className="cb-name-row">
                <input className="cb-name" value={S.name} maxLength={22} spellCheck={false} autoComplete="off" aria-label="The coach's name"
                  onChange={e => setS(s => ({ ...s, name: cleanName(e.target.value) }))} onBlur={() => { if (!S.name.trim()) setS(s => ({ ...s, name: randomName() })) }} />
                <button className="fr-name-rand" onClick={() => { sfx('tap'); setS(s => ({ ...s, name: randomName(s.name) })) }} aria-label="Random name" title="Random name"><IconSpin size={18} /></button>
              </span>
              <span className="cb-identity">{identity ? identity.toUpperCase() : 'NO RATINGS YET'}</span>
            </div>
            <div className="cb-ovr"><b>{ovr == null ? '–' : shown}</b><small>OVR</small></div>
          </div>
          <ol className="cb-sheet">
            {TYPES.map((t, k) => {
              const s = S.slots[t]
              return (
                <li key={t} className={`${s ? 'is-in' : 'is-open'}${just === t && !beat ? ' is-new' : ''}`} style={{ '--cb-k': k }}>
                  <span className="cb-sheet-main">
                    <span>{LABEL[t]}</span>
                    {s ? <small><Logo team={s.team} size={16} />FROM {s.qbFull.toUpperCase()}</small> : <small>OPEN</small>}
                  </span>
                  {s ? <b style={{ color: gradeColor(s.val) }}>{valToGrade(s.val)}</b> : <b className="cb-none" aria-hidden="true" />}
                </li>
              )
            })}
          </ol>
          <div className="cb-foot">
            <button className="fr-btn fr-btn--sm fr-btn--line" disabled={busy || S.n === 0} onClick={() => { sfx('tap'); setAsk(true) }}>RESET</button>
          </div>
        </section>
      </div>
      <Confirm open={ask} title="Reset the coach?" body="The call sheet is cleared and the five spins start again." yes="RESET" no="CANCEL" onYes={startOver} onNo={() => setAsk(false)} />
    </FrShell>
  )
}
