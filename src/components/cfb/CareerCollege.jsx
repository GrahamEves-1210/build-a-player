import { useEffect, useMemo, useState } from 'react'
import { TYPES, ATTR } from '../../data/qbs'
import { RB_TYPES, RB_ATTR } from '../../data/rbs'
import { WR_TYPES, WR_ATTR } from '../../data/wrs'
import { calcOVR, calcOVRRB, calcOVRWR, getArchetype, getArchetypeRB, getArchetypeWR, valToGrade, HEADSHOT_BASE } from '../../utils/simulation'
import { collegeOVR } from '../../utils/cfbOvr'
import { seeded } from '../../lib/rng'
import { starsFor, rankFor, barAt, offersFor, startsOver } from './cfbRecruit'
import { Stars, OfferBoard, CommitBar } from './CFBOffers'
import { loadCFB } from '../../lib/cfbLoad'
import { sfx } from '../../lib/juice'
import { IconClose } from '../app/icons'
import CFBSimPage from './CFBSimPage'
import { CFB_POS, classLabel, seasonEvent, collegeGap, photoLookup } from './cfbShared'
import './cfb.css'

// ── Career: START IN COLLEGE ─────────────────────────────────────────────────
// A football Career (QB, WR or RB) that starts with a college season or two before the draft. He's built
// with the NFL builder (c.build, the career's own ratings, never touched here). For college he plays with
// the college boost: the college gap on every trait but his size (a pro talent against college competition).
// The boosted OVR makes his recruiting stars and national ranking, the stars bring the offers (real schools,
// matched to the stars, and a better shot where the starter at his spot is weaker), he commits, and the
// season plays out on College Football's own season screen (CFBSimPage) with the CFB engine: as the
// starter if he's better than the man there, else as his backup. Then ENTER THE NFL DRAFT, or RETURN FOR
// ANOTHER SEASON once (a small development bump; stay, or transfer). Entering the draft takes the boost
// off (his NFL-builder ratings again, shown before it happens) and the career goes on at the combine with
// his college résumé (c.college) nudging his draft stock a little (lib/career.js stockOf).
//
// The college phase lives on the career save (c.phase 'college', c.college), so leaving and coming back
// picks it up at the same screen. A season is kept as its seed and inputs, not its result: the engine is
// deterministic, so it's played again on the way back in (a save stays small, cloud copy included).
// This file and the CFB data load only for a career in college (AppCareer.jsx: lazy).
const POS = {
  qb: { types: TYPES, attr: ATTR, ovr: (b, t) => collegeOVR(calcOVR(b, t)), arch: getArchetype },
  wr: { types: WR_TYPES, attr: WR_ATTR, ovr: (b, t) => collegeOVR(calcOVRWR(b, t)), arch: getArchetypeWR },
  rb: { types: RB_TYPES, attr: RB_ATTR, ovr: (b, t) => collegeOVR(calcOVRRB(b, t)), arch: getArchetypeRB },
}
const clamp = (a, b, x) => Math.max(a, Math.min(b, x))
const YEAR_OF = ['FR', 'SO']          // his class, season by season
const SIM_YEAR = ['JR', 'SR']         // what the engine is told, so his draft stock reads as a draft-eligible player's
const DEV_STEPS = 3                   // a returning player: one step on his three weakest traits
const NO_BOOST = new Set(['size'])   // his frame: the college gap doesn't touch it, and a returning year doesn't develop it (cfbShared collegeGap)

// the college build: the NFL build up by the college gap (cfbShared.js collegeGap, the same one the draft takes back
// off: two steps on every trait, none on Size), plus a returning year's development, capped at S
export function collegeBuild(build, types, dev = {}, pos = null) {
  const p = pos ?? (types.includes('arm') ? 'qb' : types.includes('carrying') ? 'rb' : 'wr')
  return Object.fromEntries(types.map(t => {
    const ch = build[t]
    if (!ch) return [t, ch]
    return [t, { ...ch, val: clamp(0, 11, (ch.val ?? 0) + collegeGap(p, t) + (dev[t] ?? 0)) }]
  }))
}
// (the stars, the ranking, the offers and the offer board: cfbRecruit.js and CFBOffers.jsx, shared with the one-off mode)

// ── A season as the backup: the school plays its real starter, he gets a backup's snaps ──────────
const LINE_KEYS = {
  qb: ['comp', 'att', 'passYds', 'tds', 'ints', 'sacks', 'rushAtt', 'rushYds', 'rushTDs', 'rating', 'eff'],
  rb: ['carries', 'rushYds', 'rushTDs', 'ypc', 'recs', 'recYds', 'recTDs', 'fumbles', 'long'],
  wr: ['targets', 'rec', 'recYds', 'recTDs', 'long'],
}
function backupLine(g, pos, rnd) {
  const blow = Math.abs((g.mySc ?? 0) - (g.oppSc ?? 0)) >= 21   // the starters sit in a blowout
  const td = (g.mySc ?? 0) >= 6   // (his touchdown is on the board: none in a game his team never reached the end zone)
  if (pos === 'qb') {
    const att = blow ? 4 + Math.floor(rnd() * 7) : rnd() < 0.12 ? 1 + Math.floor(rnd() * 3) : 0
    const comp = Math.round(att * (0.5 + rnd() * 0.2))
    return { att, comp, passYds: Math.round(comp * (8 + rnd() * 5)), tds: att >= 5 && rnd() < 0.3 && td ? 1 : 0, ints: att && rnd() < 0.07 ? 1 : 0, sacks: 0, rushAtt: att ? Math.floor(rnd() * 3) : 0, rushYds: att ? Math.floor(rnd() * 14) : 0, rushTDs: 0 }
  }
  if (pos === 'rb') {
    const base = g.carries ?? 14
    const carries = Math.max(1, Math.round(base * (0.28 + rnd() * 0.17) + (blow ? 3 : 0)))
    const ypc = (g.carries ? g.rushYds / Math.max(1, g.carries) : 4.5) * (0.82 + rnd() * 0.2)
    const recs = Math.floor(rnd() * 2.4)
    const rushYds = Math.round(carries * ypc)
    return { carries, rushYds, rushTDs: rnd() < 0.2 + (blow ? 0.15 : 0) && td ? 1 : 0, ypc: +(rushYds / carries).toFixed(1), recs, recYds: recs * Math.round(5 + rnd() * 5), recTDs: 0, fumbles: 0, long: Math.max(3, Math.round(Math.max(1, ypc) * (1.6 + rnd() * 2))) }
  }
  const targets = Math.floor(rnd() * 4) + (blow ? 1 : 0)
  const rec = Math.round(targets * (0.5 + rnd() * 0.3))
  return { targets, rec, recYds: rec * Math.round(8 + rnd() * 7), recTDs: rec && rnd() < 0.1 && td ? 1 : 0, long: rec ? Math.round(10 + rnd() * 20) : 0 }
}
function totalsOf(gs, pos) {
  const sum = k => gs.reduce((a, g) => a + (g[k] ?? 0), 0)
  const max = k => gs.reduce((a, g) => Math.max(a, g[k] ?? 0), 0)
  if (pos === 'qb') { const att = sum('att'), comp = sum('comp'); return { seasonPassYds: sum('passYds'), seasonTDs: sum('tds'), seasonINTs: sum('ints'), seasonCompletions: comp, seasonAttempts: att, seasonCompPct: att ? Math.round(comp / att * 1000) / 10 : 0, seasonRushYds: sum('rushYds'), seasonRushTDs: sum('rushTDs'), gp: gs.filter(g => g.att || g.rushAtt).length } }
  if (pos === 'rb') { const car = sum('carries'); return { seasonCarries: car, seasonRushYds: sum('rushYds'), seasonRushTDs: sum('rushTDs'), seasonYPC: car ? Math.round(sum('rushYds') / car * 10) / 10 : 0, seasonRecs: sum('recs'), seasonRecYds: sum('recYds'), seasonRecTDs: sum('recTDs'), seasonLong: max('long'), gp: gs.filter(g => g.carries).length } }
  const rec = sum('rec'); return { seasonTargets: sum('targets'), seasonRecs: rec, seasonRecYds: sum('recYds'), seasonRecTDs: sum('recTDs'), seasonYPR: rec ? Math.round(sum('recYds') / rec * 10) / 10 : 0, seasonLong: max('long'), gp: gs.filter(g => g.targets).length }
}
// the awards were the starter's, under his own name: none of them is the build's
const notUser = x => (Array.isArray(x) ? x.map(notUser) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'isUser' || k === 'userWon' || k === 'userFinalist' ? false : k === 'userPlace' || (k === 'user' && typeof v === 'string') ? null : notUser(v)]))
  : x)
function asBackup(r, pos, seed, starter, ovr) {
  const rnd = seeded(`cfb-backup-${seed}`)
  const blank = Object.fromEntries(LINE_KEYS[pos].map(k => [k, null]))
  const swap = g => ({ ...g, ...blank, ...backupLine(g, pos, rnd) })
  const games = (r.games ?? []).map(swap)
  const post = (r.cfb?.postseason ?? []).map(swap)
  const ccg = post.filter(g => g.round === 'Conference Championship')
  const c = r.cfb ?? {}
  return {
    ...r, games, role: 'backup', starterName: starter?.name ?? null, ovr: ovr ?? r.ovr,   // (his OVR, not the starter's the engine played)
    cfb: {
      ...c, postseason: post,
      totals: { regular: totalsOf(games, pos), throughCCG: totalsOf([...games, ...ccg], pos), full: totalsOf([...games, ...post], pos) },
      awards: notUser(c.awards ?? {}),
      // (the board the engine made is the starter's: he isn't on it, and the projection isn't his)
      draft: { ...(c.draft ?? {}), declares: false, tier: 'udfa', label: 'Undrafted free agent', round: null, pick: null, overall: null, boardRank: null, board: (c.draft?.board ?? []).map(x => ({ ...x, isUser: false })), note: `A backup year behind ${starter?.name ?? 'the starter'}: the scouts have seen little of him` },
    },
  }
}

// one college season, played (again) from what the save keeps
// what the draft board knows of his earlier college seasons (cfbSimulation opts.career): the best Heisman and
// All-America finish, how many seasons, each one's totals. Played again from their seeds, like everything here
function careerBefore(data, c, s) {
  const k = (c.college?.seasons ?? []).findIndex(x => x.seed === s.seed)
  const prior = k > 0 ? c.college.seasons.slice(0, k).map(x => summaryOf(playSeason(data, c, x), x, c.pos, {})) : []
  if (!prior.length) return null
  return {
    seasons: prior.length,
    heisman: prior.some(x => x.heismanFinish === 'won') ? 'won' : prior.some(x => x.heismanFinish === 'finalist') ? 'finalist' : null,
    allAmerica: prior.some(x => x.allAmerica === 'first') ? 'first' : prior.some(x => x.allAmerica === 'second') ? 'second' : null,
    totals: prior.map(x => x.totals ?? {}),
  }
}
function playSeason(data, c, s) {
  const P = POS[c.pos]
  const team = data.teams.find(t => t.short === s.school)
  const career = s.role !== 'backup' ? careerBefore(data, c, s) : null
  if (s.role !== 'backup') return data.sim.runCFBSimulation(collegeBuild(c.build, P.types, s.dev), P.types, team, c.pos, s.seed, 'career', null, { name: c.name, year: s.simYear, ...(career ? { career } : {}) })
  // the engine always plays its build first on the depth chart: hand it the real No. 1 (himself, so the
  // school is the school it really is), and the build sits behind the starter he couldn't beat
  const one = data.pools[c.pos].filter(p => p.team === s.school).sort((a, b) => (a.depth ?? 9) - (b.depth ?? 9))[0]
  const sb = Object.fromEntries(P.types.map(t => [t, { type: t, val: one?.attrs?.[t] ?? 5, qbFull: one?.name, team: one?.team }]))
  return asBackup(data.sim.runCFBSimulation(sb, P.types, team, c.pos, s.seed, 'career', null, { name: one?.name ?? 'Starter', year: one?.year ?? 'JR' }), c.pos, s.seed, barAt(data, s.school, c.pos), P.ovr(collegeBuild(c.build, P.types, s.dev), P.types))
}

// what a season leaves on his résumé
const AWARD_KEYS = ['daveyOBrien', 'doakWalker', 'biletnikoff', 'maxwell', 'walterCamp', 'confPOY']
function summaryOf(r, s, pos, teamsBy) {
  const c = r.cfb ?? {}
  const t = c.totals?.full ?? {}
  const a = c.awards ?? {}
  const statLine = pos === 'qb' ? `${(t.seasonPassYds ?? 0).toLocaleString()} pass yds, ${t.seasonTDs ?? 0} TD, ${t.seasonINTs ?? 0} INT`
    : pos === 'rb' ? `${(t.seasonRushYds ?? 0).toLocaleString()} rush yds, ${(t.seasonRushTDs ?? 0) + (t.seasonRecTDs ?? 0)} TD`
    : `${t.seasonRecs ?? 0} rec, ${(t.seasonRecYds ?? 0).toLocaleString()} yds, ${t.seasonRecTDs ?? 0} TD`
  // (the Heisman and All-America kept apart from the rest: the résumé takes the best finish of each)
  const awards = AWARD_KEYS.filter(k => a[k]?.userWon).map(k => a[k].award)
  const ap = c.apPath ?? []
  return {
    school: s.school, schoolName: teamsBy[s.school]?.school ?? s.school, cls: s.cls, role: s.role,
    record: c.record?.final ?? `${r.wins}-${r.losses}`, finalRank: ap.length ? ap[ap.length - 1].rank ?? null : null,
    champion: !!r.champion, stats: statLine, awards, heisman: !!a.heisman?.userWon,
    heismanFinish: a.heisman?.userWon ? 'won' : a.heisman?.userFinalist ? 'finalist' : null, allAmerica: a.allAmerica?.user ?? null,
    totals: Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'number')),
    draft: c.draft?.label ?? null, round: c.draft?.round ?? null,
  }
}
// the college résumé's pull on draft day: picks earlier (+) or later (-), a nudge, never more than seven
// the whole college career in one line: each season's school and record, the totals of every season
// (a backup year adds its own line), and the best finish per award (a win beats a finalist; two wins: 2×)
function resumeOf(sums, pos) {
  const sum = k => sums.reduce((n, x) => n + (x.totals?.[k] ?? 0), 0)
  const stats = pos === 'qb' ? `${sum('seasonPassYds').toLocaleString()} pass yds, ${sum('seasonTDs')} TD, ${sum('seasonINTs')} INT`
    : pos === 'rb' ? `${sum('seasonRushYds').toLocaleString()} rush yds, ${sum('seasonRushTDs') + sum('seasonRecTDs')} TD`
    : `${sum('seasonRecs')} rec, ${sum('seasonRecYds').toLocaleString()} yds, ${sum('seasonRecTDs')} TD`
  const times = (n, what) => (n > 1 ? `${n}× ${what}` : what)
  const hw = sums.filter(x => x.heismanFinish === 'won').length, hf = sums.filter(x => x.heismanFinish === 'finalist').length
  const aa1 = sums.filter(x => x.allAmerica === 'first').length, aa2 = sums.filter(x => x.allAmerica === 'second').length
  const counts = {}
  for (const x of sums) for (const w of x.awards ?? []) counts[w] = (counts[w] ?? 0) + 1
  return [
    sums.map(x => `${x.schoolName} ${x.record}`).join(', '),
    stats,
    hw ? times(hw, 'Heisman Trophy') : hf ? times(hf, 'Heisman finalist') : null,
    ...Object.entries(counts).map(([w, n]) => times(n, w)),
    aa1 ? times(aa1, 'All-American (first team)') : aa2 ? times(aa2, 'All-American (second team)') : null,
    // (no draft stock here: the combine's own projection, nudge included, is the one number shown)
  ].filter(Boolean).join(' · ')
}
function stockNudge(sums) {
  const last = sums[sums.length - 1]
  if (!last) return 0
  const r = Array.isArray(last.round) ? last.round : last.round ? [last.round, last.round] : null
  let n = !r ? -2 : r[1] <= 1 ? 5 : r[0] <= 1 ? 3 : r[0] <= 3 ? 1 : 0
  // (no extra for a Heisman: the last season's projection already reads his whole college career)
  return clamp(-7, 7, n)
}

export default function CareerCollege({ c, setCareer, onExit }) {
  const [data, setData] = useState(null)
  const [picked, setPicked] = useState(null)
  const [moving, setMoving] = useState(null)   // the transfer screen's pick: stay, or a portal school
  const [exit, setExit] = useState(false)
  const [returning, setReturning] = useState(false)
  const P = POS[c.pos]
  const col = c.college ?? { stage: 'recruit', seasons: [] }
  useEffect(() => {
    document.documentElement.classList.add('is-cfb')
    return () => document.documentElement.classList.remove('is-cfb')
  }, [])
  useEffect(() => { let live = true; loadCFB().then(d => { if (live) setData(d) }); return () => { live = false } }, [])
  const teamsBy = useMemo(() => Object.fromEntries((data?.teams ?? []).map(t => [t.short, t])), [data])
  const confOf = useMemo(() => Object.fromEntries((data?.conferences ?? []).map(x => [x.id, x])), [data])
  const photoOf = useMemo(() => photoLookup(data?.pools, HEADSHOT_BASE), [data])
  const schoolOf = short => String(teamsBy[short]?.school ?? short).toUpperCase()

  const cb = useMemo(() => collegeBuild(c.build, P.types), [c.build, P.types])
  const cOvr = P.ovr(cb, P.types)
  const stars = starsFor(cOvr)
  const rank = useMemo(() => rankFor(cOvr, c.pos, c.seed, c.ovr), [cOvr, c.pos, c.seed, c.ovr])
  // the offers, made once and kept on the save
  useEffect(() => {
    if (!data || col.offers) return
    setCareer({ ...c, college: { ...col, stars, rank, offers: offersFor(data, { stars, ovr: cOvr, pos: c.pos, seed: c.seed }) } })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const si = col.seasons.length - 1
  const cur = col.seasons[si] ?? null
  const result = useMemo(() => (data && cur ? playSeason(data, c, cur) : null), [data, cur?.seed, cur?.school, cur?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  const put = college => setCareer({ ...c, college: { ...col, ...college } })
  // a new season at a school: kept as its seed and inputs; booked for XP like any college season
  const begin = (short, dev = {}) => {
    const k = col.seasons.length
    const ovr = P.ovr(collegeBuild(c.build, P.types, dev), P.types)
    const bar = barAt(data, short, c.pos)
    const s = { school: short, schoolName: teamsBy[short]?.school ?? short, seed: `${c.seed}-cfb-${k}-${short}`, cls: YEAR_OF[k], simYear: SIM_YEAR[k], role: startsOver(bar, ovr, k) ? 'starter' : 'backup', dev, view: 0 }
    const seasons = [...col.seasons, s]
    put({ stage: 'season', seasons })
    try {
      const r = playSeason(data, { ...c, college: { ...col, seasons } }, s)
      window.dispatchEvent(new CustomEvent('bap:season', { detail: seasonEvent(r, c.pos, !!c.sandbox) }))
    } catch {}
    setPicked(null); setReturning(false)
    sfx('whistle'); window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // ENTER THE NFL DRAFT: the boost comes off, the résumé goes on, the combine is next
  const finish = () => {
    // every season played again from its seed (the engine is deterministic), so the résumé is what was played
    const sums = col.seasons.map((s, i) => summaryOf(i === si && result ? result : playSeason(data, c, s), s, c.pos, teamsBy))
    const last = sums[sums.length - 1]
    const line = resumeOf(sums, c.pos)
    setCareer({
      ...c, phase: 'draft', step: 'combine', age: (c.age ?? 21) + sums.length,
      college: { done: true, school: last?.school, schoolName: last?.schoolName, line, seasons: sums, stock: stockNudge(sums), stars, rank },
    })
    sfx('purchase')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  if (!data) return <div className="ag-screen cfb-screen"><p className="cfb-wait">Loading College Football…</p></div>

  // ── the season ──────────────────────────────────────────────────────────
  if (col.stage === 'season' && cur && result && !returning) {
    const sch = teamsBy[cur.school]?.school ?? cur.school
    const canReturn = col.seasons.length < 2
    const devFor = () => {
      // his three weakest traits (not his size), one step each
      const cbNow = collegeBuild(c.build, P.types, cur.dev)
      return Object.fromEntries(P.types.filter(t => !NO_BOOST.has(t) && cbNow[t]).sort((a, b) => cbNow[a].val - cbNow[b].val).slice(0, DEV_STEPS).filter(t => cbNow[t].val < 11).map(t => [t, (cur.dev?.[t] ?? 0) + 1]))
    }
    const keepSummary = () => col.seasons.map((s, i) => (i === si && !s.summary ? { ...s, summary: summaryOf(result, s, c.pos, teamsBy) } : s))
    return (
      <>
        <CFBSimPage result={result} pos={c.pos} userName={c.name} teams={teamsBy} attrMap={P.attr} photoOf={photoOf}
          archetype={P.arch(P.ovr(collegeBuild(c.build, P.types, cur.dev), P.types), collegeBuild(c.build, P.types, cur.dev), P.types)}
          roleNote={cur.role === 'backup' ? `${classLabel(cur.cls)} · backup to ${result.starterName}` : `${classLabel(cur.cls)} · ${sch}'s starter`}
          userYear={cur.cls} season={2026 + si} rewards={false}
          stage={cur.view ?? 0}
          onStage={k => put({ seasons: col.seasons.map((s, i) => (i === si ? { ...s, view: k } : s)) })}
          onHome={onExit}
          endActions={(
            <div className="cfbs-actions cfbr-decide">
              <button className="cfbs-btn is-main is-draft" onClick={() => { put({ seasons: keepSummary() }); setExit(true); sfx('tap') }}>ENTER THE NFL DRAFT<small>The college boost comes off · then the combine</small></button>
              {canReturn
                ? <button className="cfbs-btn" onClick={() => { put({ seasons: keepSummary() }); setReturning(devFor()); sfx('tap') }}>RETURN FOR ANOTHER SEASON<small>One more year in college, then the draft</small></button>
                : <p className="cfbs-note">Two seasons in: the draft is next.</p>}
            </div>
          )} />
        {exit && (
          <div className="cfbd-overlay" role="dialog" aria-modal="true" aria-label="Enter the NFL Draft">
            <div className="cfbd">
              <div className="cfbd-head">
                <div><small>{CFB_POS[c.pos].label} · {sch} · {classLabel(cur.cls)}</small><h2>Enter the NFL Draft</h2></div>
                <button className="ag-round-btn" onClick={() => setExit(false)} aria-label="Close"><IconClose size={16} /></button>
              </div>
              <p className="cfbd-why"><b>The college boost comes off.</b> He was a pro talent against college competition. Against NFL players his ratings are his own again: <b>back to the ratings he was built with</b>. His college résumé goes with him to the combine and gives his draft stock a nudge.</p>
              <table className="cfbd-table">
                <thead><tr><th>TRAIT</th><th>COLLEGE</th><th /><th>NFL</th></tr></thead>
                <tbody>
                  {P.types.filter(t => c.build[t]).map(t => {
                    const from = collegeBuild(c.build, P.types, cur.dev)[t].val
                    return (
                      <tr key={t}>
                        <td>{P.attr[t]?.label ?? t}<small>{from === c.build[t].val ? 'No boost' : 'College boost off'}</small></td>
                        <td className="is-g">{valToGrade(from)}</td><td className="is-arrow" aria-hidden="true">→</td><td className="is-g is-new">{valToGrade(c.build[t].val)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="cfbd-note">OVR {P.ovr(collegeBuild(c.build, P.types, cur.dev), P.types)} in college → {c.ovr} OVR in the NFL</p>
              <div className="cfbd-actions">
                <button className="cfbs-btn is-main" onClick={finish}>ENTER THE DRAFT</button>
                <button className="cfbs-btn" onClick={() => setExit(false)}>NOT YET</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── a second season: the development, then stay or transfer ──────────────
  if (col.stage === 'season' && cur && returning) {
    const dev = returning
    const ovr2 = P.ovr(collegeBuild(c.build, P.types, dev), P.types)
    const stay = barAt(data, cur.school, c.pos)
    const stayStarts = startsOver(stay, ovr2, 1)
    const away = offersFor(data, { stars: starsFor(ovr2), ovr: ovr2, pos: c.pos, seed: `${c.seed}-portal`, skip: [cur.school], n: 3 })
    return (
      <div className="ag-screen cfb-screen cfbr">
        <div className="ag-screen-head">
          <div><span className="ag-eyebrow">{c.name.toUpperCase()} · {CFB_POS[c.pos].label}</span><h1 className="ag-h1">Another Season</h1></div>
          <button className="ag-round-btn" onClick={() => setReturning(false)} aria-label="Back"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body">
          <section>
            <h2 className="cfb-label">THE OFFSEASON · {classLabel(YEAR_OF[1]).toUpperCase()} YEAR</h2>
            <table className="cfbd-table">
              <thead><tr><th>TRAIT</th><th>NOW</th><th /><th>NEXT YEAR</th></tr></thead>
              <tbody>{Object.keys(dev).map(t => (
                <tr key={t}><td>{P.attr[t]?.label ?? t}<small>A year of development</small></td><td className="is-g">{valToGrade(collegeBuild(c.build, P.types, cur.dev)[t].val)}</td><td className="is-arrow">→</td><td className="is-g is-up">{valToGrade(collegeBuild(c.build, P.types, dev)[t].val)}</td></tr>
              ))}</tbody>
            </table>
          </section>
          <section>
            <h2 className="cfb-label">STAY OR TRANSFER</h2>
            <OfferBoard pos={c.pos} teamsBy={teamsBy} confOf={confOf} picked={moving}
              offers={[{ short: cur.school, starts: stayStarts, bar: stay ? { name: stay.name, ovr: stay.ovr, year: stay.year } : null, stay: true }, ...away]}
              onPick={short => { setMoving(short); sfx('tap') }} />
          </section>
          <CommitBar label={!moving ? 'PICK A SCHOOL' : moving === cur.school ? `STAY AT ${schoolOf(moving)}` : `TRANSFER TO ${schoolOf(moving)}`} on={!!moving} onGo={() => moving && begin(moving, dev)} />
        </div>
      </div>
    )
  }

  // ── recruiting ──────────────────────────────────────────────────────────
  const offers = col.offers ?? []
  const sel = picked ? offers.find(o => o.short === picked) : null
  return (
    <div className="ag-screen cfb-screen cfbr">
      <div className="ag-screen-head">
        <div><span className="ag-eyebrow">CAREER · START IN COLLEGE</span><h1 className="ag-h1">Recruiting</h1></div>
        <button className="ag-round-btn" onClick={onExit} aria-label="Home"><IconClose size={16} /></button>
      </div>
      <div className="ag-screen-body">
        <section className="cfbr-card">
          <div className="cfbr-who"><small>{CFB_POS[c.pos].name.toUpperCase()} · CLASS OF 2026</small><b>{c.name}</b></div>
          <Stars n={stars} />
          <div className="cfbr-rank">
            <span><b>No. {rank.overall.toLocaleString()}</b><small>OVERALL</small></span>
            <span><b>No. {rank.posRank}</b><small>{CFB_POS[c.pos].label}</small></span>
            <span><b>{cOvr}</b><small>COLLEGE OVR</small></span>
          </div>
        </section>
        <section>
          <h2 className="cfb-label">THE COLLEGE BOOST</h2>
          <p className="cfbs-note">A pro talent against college competition: <b>two grades up on every trait</b> (a B plays like an A-), none on Size. The same comes off when he enters the NFL Draft.</p>
          <table className="cfbd-table">
            <thead><tr><th>TRAIT</th><th>NFL</th><th /><th>COLLEGE</th></tr></thead>
            <tbody>{P.types.filter(t => c.build[t]).map(t => (
              <tr key={t}><td>{P.attr[t]?.label ?? t}<small>{NO_BOOST.has(t) ? 'His frame: no boost' : cb[t].val === c.build[t].val ? 'Already S' : cb[t].val - c.build[t].val >= 2 ? 'Up two grades' : 'Up to S'}</small></td><td className="is-g">{valToGrade(c.build[t].val)}</td><td className="is-arrow">→</td><td className={`is-g${cb[t].val > c.build[t].val ? ' is-up' : ''}`}>{valToGrade(cb[t].val)}</td></tr>
            ))}</tbody>
          </table>
          <p className="cfbd-note">{c.ovr} OVR → {cOvr} college OVR · {stars}-star recruit</p>
        </section>
        <section>
          <h2 className="cfb-label">OFFERS</h2>
          <OfferBoard pos={c.pos} teamsBy={teamsBy} confOf={confOf} offers={offers} picked={picked} onPick={short => { setPicked(short); sfx('tap') }} />
        </section>
        <CommitBar label={sel ? `COMMIT TO ${schoolOf(sel.short)}` : 'PICK A SCHOOL'} on={!!sel} onGo={() => sel && begin(sel.short)} />
      </div>
    </div>
  )
}
