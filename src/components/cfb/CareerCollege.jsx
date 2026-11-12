import { useEffect, useMemo, useState } from 'react'
import { TYPES, ATTR } from '../../data/qbs'
import { RB_TYPES, RB_ATTR } from '../../data/rbs'
import { WR_TYPES, WR_ATTR } from '../../data/wrs'
import { calcOVR, calcOVRRB, calcOVRWR, getArchetype, getArchetypeRB, getArchetypeWR, valToGrade, HEADSHOT_BASE } from '../../utils/simulation'
import { collegeOVR } from '../../utils/cfbOvr'
import { starsFor, rankFor, barAt, offersFor, startsOver } from './cfbRecruit'
import { Stars, OfferBoard, CommitBar } from './CFBOffers'
import { loadCFB } from '../../lib/cfbLoad'
import { sfx } from '../../lib/juice'
import { IconClose } from '../app/icons'
import CFBSimPage from './CFBSimPage'
import { CFB_POS, classLabel, seasonEvent, collegeGap, photoLookup, seasonData } from './cfbShared'
import { CLASSES, CLASS_NAME, classAt, seasonsFrom, canDeclare, canComeBack, isUnder, classAge, draftAge, upgradePoints, backupSeason } from './cfbClass'
import CFBOffseason from './CFBOffseason'
import { SPORT } from '../../lib/career'
import './cfb.css'

// ── Career: START IN COLLEGE ─────────────────────────────────────────────────
// A football Career (QB, WR or RB) that starts with a college season or two before the draft. He's built
// with the NFL builder (c.build, the career's own ratings, never touched here). For college he plays with
// the college boost: the college gap on every trait but his size (a pro talent against college competition).
// The boosted OVR makes his recruiting stars and national ranking, the stars bring the offers (real schools,
// matched to the stars, and a better shot where the starter at his spot is weaker), he commits, and the
// season plays out on College Football's own season screen (CFBSimPage) with the CFB engine: as the
// starter if he's better than the man there, else as his backup.
// CLASS YEARS (2026-11-11, the same rules as the one-off mode: cfbClass.js): he starts as a freshman, sophomore,
// junior or senior (the switch on the recruiting card, col.cls0) and plays from that class to the draft. After a
// freshman or sophomore season the way on is the next season; after his junior season ENTER THE NFL DRAFT or
// come back; a senior is out of eligibility. Every season earns one to three upgrade points, spent on his traits
// in the offseason (CFBOffseason: each one a step of college development, a season's `dev`), then stay or transfer.
// Entering the draft takes the boost off (his NFL-builder ratings again, plus what he trained in college, shown
// before it happens) and the career goes on at the combine with his college résumé (c.college) nudging his draft
// stock a little (lib/career.js stockOf).
// (A career that was already in college before class years keeps its own run: a freshman then a sophomore season,
// the draft open after either: `legacy` below.)
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
// (a career in college before class years, `legacy`: its two seasons' labels, and what the engine was told)
const YEAR_OF = ['FR', 'SO']
const SIM_YEAR = ['JR', 'SR']
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
  // (s.adv, a season with class years: the rosters of its own year, cfbShared seasonData, the year on the draft
  // line, and going or staying his own call. A season from before them plays the first season's rosters, as it did)
  const k = Math.max(0, (c.college?.seasons ?? []).findIndex(x => x.seed === s.seed))
  const sd = s.adv ? seasonData(data, k) : data
  const b = collegeBuild(c.build, P.types, s.dev)
  if (s.role !== 'backup') return { ...data.sim.runCFBSimulation(b, P.types, team, c.pos, s.seed, 'career', null, { name: c.name, year: s.simYear, ...(career ? { career } : {}), ...(s.adv ? { choice: true, season: 2026 + k, ...(k ? { pools: sd.pools } : {}) } : {}) }), ovr: P.ovr(b, P.types) }   // (the college overall the recruiting card and the offseason show)
  // (the school plays its real starter and the build sits behind the man he couldn't beat: cfbClass backupSeason)
  return backupSeason(data.sim, sd.pools, P.types, team, c.pos, s.seed, { ovr: P.ovr(b, P.types), ...(s.adv ? { cls: s.simYear, build: b, name: c.name, season: 2026 + k, usePools: k > 0 } : {}) })
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
  const [offOpen, setOffOpen] = useState(false)   // the offseason's upgrade screen (its state is on the save: col.off)
  const P = POS[c.pos]
  const col = c.college ?? { stage: 'recruit', seasons: [] }
  // (in college before class years: no starting class on the save, and a season already played)
  const legacy = col.cls0 == null && col.seasons.length > 0
  const cls0 = Math.max(0, Math.min(3, col.cls0 ?? 0))
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
    const cls = legacy ? YEAR_OF[k] : classAt(cls0, k)
    const bar = barAt(legacy ? data : seasonData(data, k), short, c.pos)
    const last = col.seasons[k - 1]
    // (an underclassman has to beat the starter, unless the job was already his there; a junior or senior plays)
    const starts = legacy ? startsOver(bar, ovr, k) : !isUnder(cls) || (last && last.school === short && last.role !== 'backup') || !bar || ovr > (bar.ovr ?? 0)
    const s = { school: short, schoolName: teamsBy[short]?.school ?? short, seed: `${c.seed}-cfb-${k}-${short}`, cls, simYear: legacy ? SIM_YEAR[k] : cls, role: starts ? 'starter' : 'backup', dev, view: 0, ...(legacy ? {} : { adv: true }) }
    const seasons = [...col.seasons, s]
    // (the points he didn't spend this offseason stay in the bank)
    put({ stage: 'season', seasons, ...(legacy ? {} : { cls0 }), bank: col.off ? col.off.left : col.bank ?? 0, off: null })
    try {
      const r = playSeason(data, { ...c, college: { ...col, seasons } }, s)
      window.dispatchEvent(new CustomEvent('bap:season', { detail: seasonEvent(r, c.pos, !!c.sandbox) }))
    } catch {}
    setPicked(null); setReturning(false); setOffOpen(false); setMoving(null)
    sfx('whistle'); window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // ENTER THE NFL DRAFT: the boost comes off, the résumé goes on, the combine is next
  const finish = () => {
    // every season played again from its seed (the engine is deterministic), so the résumé is what was played
    const sums = col.seasons.map((s, i) => summaryOf(i === si && result ? result : playSeason(data, c, s), s, c.pos, teamsBy))
    const last = sums[sums.length - 1]
    const line = resumeOf(sums, c.pos)
    // what he trained in college goes to the pros with him (the college boost is what comes off), and the points
    // he never spent are his to spend in the league
    const build = trained(cur?.dev)
    setCareer({
      ...c, build, ovr: SPORT.nfl.ovr(c.pos, build), dev: { ...c.dev, points: (c.dev?.points ?? 0) + (col.bank ?? 0) },
      phase: 'draft', step: 'combine', age: legacy || !cur ? (c.age ?? 21) + sums.length : draftAge(cur.cls),
      college: { done: true, school: last?.school, schoolName: last?.schoolName, line, seasons: sums, stock: stockNudge(sums), stars, rank },
    })
    sfx('purchase')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // his NFL build with his college development on it (each step a grade, counted on the trait like Career's own upgrades)
  const trained = dev => Object.fromEntries(P.types.map(t => { const ch = c.build[t], n = dev?.[t] ?? 0; return [t, ch && n ? { ...ch, val: Math.min(11, (ch.val ?? 0) + n), upgraded: (ch.upgraded ?? 0) + n } : ch] }))

  if (!data) return <div className="ag-screen cfb-screen"><p className="cfb-wait">Loading College Football…</p></div>

  // ── the offseason: this season's upgrade points, spent on his traits (the one-off mode's screen) ──
  if (col.stage === 'season' && cur && result && offOpen && col.off) {
    const earned = upgradePoints(result, c.pos)
    const nextCls = legacy ? YEAR_OF[1] : classAt(cls0, col.seasons.length)
    const o = col.off
    const ob = Object.fromEntries(Object.entries(collegeBuild(c.build, P.types, o.dev)).map(([t, ch]) => [t, ch ? { ...ch, upgraded: (ch.upgraded ?? 0) + (o.dev?.[t] ?? 0) } : ch]))
    const fresh = { dev: cur.dev ?? {}, left: (col.bank ?? 0) + earned.pts }
    return (
      <CFBOffseason who={c.name} pos={c.pos} school={teamsBy[cur.school]?.school ?? cur.school} cls={legacy ? YEAR_OF[si] ?? 'SO' : cur.cls} nextCls={nextCls} earned={earned} attr={P.attr}
        career={{ sport: 'nfl', pos: c.pos, types: P.types, build: ob, age: classAge(nextCls), year: 0, phase: 'offseason', name: c.name, dev: { points: o.left, spent: 0 }, decisions: [] }}
        onCareer={n => { const t = P.types.find(x => n.build[x] && n.build[x].val !== ob[x].val); if (t) put({ off: { dev: { ...o.dev, [t]: (o.dev?.[t] ?? 0) + 1 }, left: n.dev.points } }) }}
        ovr={P.ovr(ob, P.types)} ovrWas={P.ovr(collegeBuild(c.build, P.types, cur.dev), P.types)}
        cta="STAY OR TRANSFER"
        onGo={() => { sfx('tap'); setOffOpen(false); setReturning(o.dev ?? {}); window.scrollTo({ top: 0, behavior: 'instant' }) }}
        onReset={o.left !== fresh.left ? () => put({ off: fresh }) : null}
        onClose={() => setOffOpen(false)} />
    )
  }

  // ── the season ──────────────────────────────────────────────────────────
  if (col.stage === 'season' && cur && result && !returning) {
    const sch = teamsBy[cur.school]?.school ?? cur.school
    // (his class decides: the draft after a junior or senior season, another year for anyone but a senior)
    const canReturn = legacy ? col.seasons.length < 2 : canComeBack(cur.cls)
    const eligible = legacy || canDeclare(cur.cls)
    const nextName = legacy ? null : CLASS_NAME[classAt(cls0, col.seasons.length)]
    const nfl = trained(cur.dev)
    const keepSummary = () => col.seasons.map((s, i) => (i === si && !s.summary ? { ...s, summary: summaryOf(result, s, c.pos, teamsBy) } : s))
    return (
      <>
        <CFBSimPage result={result} pos={c.pos} userName={c.name} teams={teamsBy} attrMap={P.attr} photoOf={photoOf}
          archetype={P.arch(P.ovr(collegeBuild(c.build, P.types, cur.dev), P.types), collegeBuild(c.build, P.types, cur.dev), P.types)}
          roleNote={cur.role === 'backup' ? `${classLabel(cur.cls)} · backup to ${result.starterName}` : `${classLabel(cur.cls)} · ${sch}'s starter`}
          userYear={cur.cls} season={2026} rewards={false}
          stage={cur.view ?? 0}
          onStage={k => put({ seasons: col.seasons.map((s, i) => (i === si ? { ...s, view: k } : s)) })}
          onHome={onExit}
          endActions={(
            <div className="cfbs-actions cfbr-decide">
              {eligible && <button className="cfbs-btn is-main is-draft" onClick={() => { put({ seasons: keepSummary() }); setExit(true); sfx('tap') }}>ENTER THE NFL DRAFT<small>The college boost comes off · then the combine</small></button>}
              {canReturn
                ? <button className={`cfbs-btn${eligible ? '' : ' is-main is-draft'}`} onClick={() => { put({ seasons: keepSummary(), off: col.off ?? { dev: cur.dev ?? {}, left: (col.bank ?? 0) + upgradePoints(result, c.pos).pts } }); setOffOpen(true); sfx('tap'); window.scrollTo({ top: 0, behavior: 'instant' }) }}>{eligible ? 'RETURN FOR ANOTHER SEASON' : `ON TO ${nextName.toUpperCase()} YEAR`}<small>{eligible ? 'Upgrade points, then stay or transfer' : 'Upgrade points, then stay or transfer · the draft opens after his junior season'}</small></button>
                : <p className="cfbs-note">{legacy ? 'Two seasons in: the draft is next.' : 'Out of eligibility: the draft is next.'}</p>}
            </div>
          )} />
        {exit && (
          <div className="cfbd-overlay" role="dialog" aria-modal="true" aria-label="Enter the NFL Draft">
            <div className="cfbd">
              <div className="cfbd-head">
                <div><small>{CFB_POS[c.pos].label} · {sch} · {classLabel(cur.cls)}</small><h2>Enter the NFL Draft</h2></div>
                <button className="ag-round-btn" onClick={() => setExit(false)} aria-label="Close"><IconClose size={16} /></button>
              </div>
              <p className="cfbd-why"><b>The college boost comes off.</b> He was a pro talent against college competition. Against NFL players his ratings are his own again: <b>the ratings he was built with{Object.values(cur.dev ?? {}).some(Boolean) ? ', plus what he trained in college' : ''}</b>. His college résumé goes with him to the combine and gives his draft stock a nudge.</p>
              <table className="cfbd-table">
                <thead><tr><th>TRAIT</th><th>COLLEGE</th><th /><th>NFL</th></tr></thead>
                <tbody>
                  {P.types.filter(t => c.build[t]).map(t => {
                    const from = collegeBuild(c.build, P.types, cur.dev)[t].val
                    return (
                      <tr key={t}>
                        <td>{P.attr[t]?.label ?? t}<small>{from === nfl[t].val ? 'No boost' : 'College boost off'}</small></td>
                        <td className="is-g">{valToGrade(from)}</td><td className="is-arrow" aria-hidden="true">→</td><td className="is-g is-new">{valToGrade(nfl[t].val)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="cfbd-note">OVR {P.ovr(collegeBuild(c.build, P.types, cur.dev), P.types)} in college → {SPORT.nfl.ovr(c.pos, nfl)} OVR in the NFL</p>
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

  // ── the next season: stay or transfer (the offseason's upgrades are on him) ──────────────
  if (col.stage === 'season' && cur && returning) {
    const dev = returning
    const ovr2 = P.ovr(collegeBuild(c.build, P.types, dev), P.types)
    const nextCls = legacy ? YEAR_OF[1] : classAt(cls0, col.seasons.length)
    const nextData = legacy ? data : seasonData(data, col.seasons.length)   // (next season's rosters: who he'd be up against)
    const stay = barAt(nextData, cur.school, c.pos)
    const stayStarts = legacy ? startsOver(stay, ovr2, 1) : !isUnder(nextCls) || cur.role !== 'backup' || !stay || ovr2 > (stay.ovr ?? 0)
    const away = offersFor(nextData, { stars: starsFor(ovr2), ovr: ovr2, pos: c.pos, seed: `${c.seed}-portal-${col.seasons.length}`, skip: [cur.school], n: 3 })
    return (
      <div className="ag-screen cfb-screen cfbr">
        <div className="ag-screen-head">
          <div><span className="ag-eyebrow">{c.name.toUpperCase()} · {CFB_POS[c.pos].label}</span><h1 className="ag-h1">Another Season</h1></div>
          <button className="ag-round-btn" onClick={() => { setReturning(false); setOffOpen(true) }} aria-label="Back"><IconClose size={16} /></button>
        </div>
        <div className="ag-screen-body">
          <section>
            <h2 className="cfb-label">{classLabel(nextCls).toUpperCase()} YEAR · STAY OR TRANSFER</h2>
            <OfferBoard compete={!legacy && !isUnder(nextCls)} pos={c.pos} teamsBy={teamsBy} confOf={confOf} picked={moving}
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
          <div className="cfbr-who"><small>{CFB_POS[c.pos].name.toUpperCase()} · {CLASS_NAME[classAt(cls0, 0)].toUpperCase()}</small><b>{c.name}</b></div>
          {/* his class: the one-off mode's switch (a freshman plays up to four seasons, a senior one) */}
          <div className="cfbr-name">
            <span className="cfbr-cls-l" id="cfbr-cls-l">CLASS<i>{seasonsFrom(cls0) === 1 ? '1 SEASON' : `UP TO ${seasonsFrom(cls0)} SEASONS`}</i></span>
            <div className="cfbr-cls" role="radiogroup" aria-labelledby="cfbr-cls-l">
              {CLASSES.map((k, i) => <button key={k} type="button" role="radio" aria-checked={cls0 === i} className={cls0 === i ? 'is-on' : ''} onClick={() => { if (cls0 !== i) { put({ cls0: i }); sfx('tap') } }}>{CLASS_NAME[k].toUpperCase()}</button>)}
            </div>
          </div>
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
          <OfferBoard compete={!isUnder(classAt(cls0, 0))} pos={c.pos} teamsBy={teamsBy} confOf={confOf} offers={offers} picked={picked} onPick={short => { setPicked(short); sfx('tap') }} />
        </section>
        <CommitBar label={sel ? `COMMIT TO ${schoolOf(sel.short)}` : 'PICK A SCHOOL'} on={!!sel} onGo={() => sel && begin(sel.short)} />
      </div>
    </div>
  )
}
