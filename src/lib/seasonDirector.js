// The season director: turns a pre-simulated season into one you steer.
//
// The engines simulate a whole season up front. The director reveals it game by
// game and, at each Moment, lets the player choose; the rest of the season is
// re-simulated with the new inputs (traits ±1, team off/def, a missed game) and
// spliced in from that point. Counting totals are re-added from the spliced
// games, rate stats come from the last run, and at the end the playoffs are
// drawn from a run whose record matches the one the player actually posted.
// Along the way it spots milestones and records and writes the headlines.

import { seeded } from './rng'
import { MILESTONES, RECORDS, headlineFor, momentFor } from './seasonFacts'

// Per position: which season fields are sums of which game fields, and how a
// "best game" is scored (same formulas as the engines).
const COUNTS = {
  nfl: {
    qb: { seasonPassYds: 'passYds', seasonTDs: 'tds', seasonINTs: 'ints', seasonRushYds: 'rushYds', seasonSacks: 'sacks' },
    rb: { seasonRushYds: 'rushYds', seasonRushTDs: 'rushTDs', seasonCarries: 'carries', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonRecs: 'recs', seasonFumbles: 'fumbles' },
    wr: { seasonRecs: 'rec', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonTargets: 'targets' },
    te: { seasonRecs: 'rec', seasonRecYds: 'recYds', seasonRecTDs: 'recTDs', seasonTargets: 'targets' },
    db: { seasonINTs: 'ints', seasonPBUs: 'pbus', seasonTackles: 'tackles', seasonTFL: 'tfl', seasonFF: 'ff', seasonPickSixes: 'pickSixes' },
    ol: { seasonPressures: 'pressures', seasonSacksAllowed: 'sacks', seasonPenalties: 'penalties', seasonPancakes: 'pancakes' },
  },
}
const BEST = {
  qb: g => g.passYds * .15 + g.tds * 12 + (g.ints === 0 ? 4 : 0) + (g.rating ?? 0) * .1,
  rb: g => g.rushYds * .14 + (g.rushTDs + g.recTDs) * 15 + g.recYds * .08 - g.fumbles * 8,
  wr: g => g.recYds * .16 + g.recTDs * 14 + g.rec * 1.5,
  te: g => g.recYds * .16 + g.recTDs * 14 + g.rec * 1.5,
  db: g => g.ints * 5 + g.pickSixes * 6 + g.pbus * 1.5 + g.tackles * .3 + g.tfl * 1.2 + g.ff * 3,
  ol: g => g.pancakes * 1.5 - g.sacks * 4 - g.pressures * 1.2 - g.penalties * 2 + (g.won ? 1.5 : 0),
  guard: g => g.pts, big: g => g.pts,
}
// How the stat line for a game reads in a headline
export const GAME_LINE = {
  qb: g => `${g.passYds} yds, ${g.tds} TD`, rb: g => `${g.rushYds} rush yds, ${g.rushTDs + (g.recTDs ?? 0)} TD`,
  wr: g => `${g.rec} rec, ${g.recYds} yds${g.recTDs ? `, ${g.recTDs} TD` : ''}`, te: g => `${g.rec} rec, ${g.recYds} yds${g.recTDs ? `, ${g.recTDs} TD` : ''}`,
  db: g => `${g.tackles} TKL${g.ints ? `, ${g.ints} INT` : ''}${g.pbus ? `, ${g.pbus} PD` : ''}`, ol: g => `${g.pancakes} pancakes, ${g.sacks} sacks allowed`,
  guard: g => `${g.pts} pts, ${g.reb} reb, ${g.ast} ast`, big: g => `${g.pts} pts, ${g.reb} reb, ${g.ast} ast`,
}
const BIG_GAME = { qb: g => g.passYds >= 330 || g.tds >= 4, rb: g => g.rushYds >= 140 || g.rushTDs + (g.recTDs ?? 0) >= 3, wr: g => g.recYds >= 130 || g.recTDs >= 2, te: g => g.recYds >= 100 || g.recTDs >= 2, db: g => g.ints >= 2 || g.pickSixes >= 1, ol: g => g.pancakes >= 6 && g.sacks === 0, guard: g => g.pts >= 38, big: g => g.pts >= 35 || g.reb >= 18 }
const BUST_GAME = { qb: g => g.ints >= 3 || g.passYds < 150, rb: g => g.rushYds < 40, wr: g => g.recYds < 30, te: g => g.recYds < 20, db: g => false, ol: g => g.sacks >= 3, guard: g => g.pts < 10, big: g => g.pts < 8 }

const clampVal = v => Math.max(1, Math.min(11, v))
function applyMods(build, team, mods) {
  const b = { ...build }
  for (const [t, d] of Object.entries(mods.attr || {})) if (b[t]) b[t] = { ...b[t], val: clampVal(b[t].val + d) }
  const t = { ...team }
  if (mods.team?.off) t.off = (t.off ?? 5) + mods.team.off
  if (mods.team?.def) t.def = (t.def ?? 5) + mods.team.def
  return { build: b, team: t }
}
const addMods = (a, b) => ({
  attr: Object.entries(b.attr || {}).reduce((acc, [t, d]) => ({ ...acc, [t]: (acc[t] || 0) + d }), { ...(a.attr || {}) }),
  team: { off: (a.team?.off || 0) + (b.team?.off || 0), def: (a.team?.def || 0) + (b.team?.def || 0) },
})
const NO_MODS = { attr: {}, team: { off: 0, def: 0 } }

export function createDirector({ sport, pos, build, team, simFn, base, seed = Math.random().toString(36).slice(2, 8), name = 'You', attrMap = {}, types = [] }) {
  const isBucket = sport === 'bucket'
  const total = base.games.length
  const stops = (isBucket ? [20, 41, 62] : [4, 9, 13]).map((at, i) => ({ i, at, kind: 'season', total }))
  stops.push({ i: 3, at: total, kind: 'playoffs', total })
  const teamNick = team?.name?.split(' ').slice(-1)[0] ?? 'Your team'
  const r = seeded(`director-${seed}`)

  const D = {
    sport, pos, total, stops, seed, name, teamNick,
    games: base.games.map(g => ({ ...g })),
    cum: NO_MODS,                 // modifiers in force for the rest of the season
    windows: [],                  // [{ from, to, mods }] temporary ones
    playoffMods: NO_MODS,
    last: base,                   // the latest full run (rate stats come from here)
    moments: [],                  // resolved: { stop, moment, option, outcome }
    milestones: [], records: [], headlines: [],
    seen: new Set(), fired: new Set(),
    finalized: false, final: null,
    xp: 0, sat: [],
  }

  const fixedRunMods = at => {
    // mods in force at game index `at`: cumulative + any window covering it
    let m = D.cum
    for (const w of D.windows) if (at >= w.from && at < w.to) m = addMods(m, w.mods)
    return m
  }
  const runWith = (mods, tag) => {
    const { build: b, team: t } = applyMods(build, team, mods)
    return simFn(b, t, `${seed}-${tag}`)
  }
  // Re-simulate everything from `from` with whatever mods apply in each stretch
  const resplice = from => {
    const edges = new Set([from, total, ...D.windows.flatMap(w => [w.from, w.to])].filter(x => x >= from && x <= total))
    const cuts = [...edges].sort((a, b) => a - b)
    for (let c = 0; c < cuts.length - 1; c++) {
      const a = cuts[c], z = cuts[c + 1]
      const mods = fixedRunMods(a)
      const run = runWith(mods, `${a}-${z}-${r().toString(36).slice(2, 6)}`)
      D.last = run
      for (let i = a; i < z; i++) {
        if (D.sat.includes(i)) continue
        D.games[i] = { ...run.games[i], wk: base.games[i].wk, g: base.games[i].g }
      }
    }
  }
  const sitGame = i => {
    // the team plays without you: a coin weighted by team strength, no stats
    const g = base.games[i]
    const strength = isBucket ? ((team.off ?? 68) + (team.def ?? 65)) / 200 : ((team.off ?? 5) + (team.def ?? 5)) / 20
    const won = r() < Math.max(.2, Math.min(.7, strength - .05))
    const zero = Object.fromEntries(Object.keys(g).filter(k => typeof g[k] === 'number' && !['wk', 'g', 'mySc', 'oppSc'].includes(k)).map(k => [k, 0]))
    const my = isBucket ? 96 + Math.floor(r() * 18) : 13 + Math.floor(r() * 14), opp = isBucket ? 96 + Math.floor(r() * 18) : 13 + Math.floor(r() * 14)
    D.games[i] = { ...g, ...zero, won, mySc: won ? Math.max(my, opp + 1) : Math.min(my, opp - 1), oppSc: opp, sat: true }
    D.sat.push(i)
  }

  // ── Moments ────────────────────────────────────────────────────────────────
  D.ctxAt = k => {
    const games = D.games.slice(0, k)
    const wins = games.filter(g => g.won).length, losses = games.length - wins
    let streak = 0, skid = 0
    for (let i = games.length - 1; i >= 0; i--) { if (games[i].won) { if (skid) break; streak++ } else { if (streak) break; skid++ } }
    return { games, wins, losses, streak, skid, last: games[games.length - 1] ?? null }
  }
  D.open = stop => {
    const m = momentFor({ sport, pos, stop, ctx: D.ctxAt(Math.min(stop.at, total)), build: applyMods(build, team, D.cum).build, types, attrMap, seed, teamNick })
    return m ? { ...m, stop } : null
  }
  D.choose = (moment, option) => {
    const e = option.effect || {}
    const at = moment.stop.at
    let outcome = null, eff = e
    if (e.gamble) {
      const hit = r() < e.gamble.p
      eff = hit ? e.gamble.hit : e.gamble.miss
      outcome = { hit, line: eff.line }
    }
    if (eff.xp) D.xp += eff.xp
    if (moment.stop.kind === 'playoffs') {
      D.playoffMods = addMods(D.playoffMods, eff)
    } else {
      if (eff.window) D.windows.push({ from: at, to: Math.min(total, at + eff.window), mods: { attr: eff.attr || {}, team: eff.team || {} } })
      else if (eff.attr || eff.team) D.cum = addMods(D.cum, eff)
      if (eff.then) D.windows.push({ from: at, to: Math.min(total, at + (eff.then.window || 2)), mods: { attr: eff.then.attr || {}, team: eff.then.team || {} } })
      if (eff.sit) for (let i = at; i < Math.min(total, at + eff.sit); i++) sitGame(i)
      resplice(at)
    }
    D.moments.push({ stop: moment.stop, moment, option, outcome })
    D.headlines.push({ at, text: headlineFor({ type: 'moment', label: outcome?.line ?? `${name}'s call: ${option.label.toLowerCase()}` }, r) })
    return outcome
  }

  // ── Milestones, records, headlines (called as games reveal) ───────────────
  const mdefs = [...(MILESTONES[sport]?.common ?? []), ...(MILESTONES[sport]?.[pos] ?? [])]
  const recs = RECORDS[sport]?.[pos] ?? []
  D.observe = k => {
    const ctx = D.ctxAt(k)
    const fresh = []
    for (const m of mdefs) {
      if (D.fired.has(m.id)) continue
      try { if (m.test(ctx)) { D.fired.add(m.id); const hit = { id: m.id, label: m.label, big: !!m.big, at: k }; D.milestones.push(hit); fresh.push(hit) } } catch {}
    }
    const g = ctx.last
    if (g) {
      for (const rec of recs) {
        if (!rec.game || D.fired.has(`rec-${rec.id}`)) continue
        if ((g[rec.game] ?? 0) > rec.value) { D.fired.add(`rec-${rec.id}`); const hit = { ...rec, at: k, got: g[rec.game] }; D.records.push(hit); fresh.push({ id: `rec-${rec.id}`, label: `${rec.label}: ${hit.got} (record was ${rec.value}, ${rec.holder})`, big: true, record: true, at: k }) }
      }
    }
    // headlines for the game just revealed
    const opp = g?.opponent?.split?.(' ').slice(-1)[0] ?? g?.opponent ?? ''
    if (g && !g.sat) {
      if (ctx.streak >= 3 && ctx.streak % 2 === 1) D.headlines.push({ at: k, text: headlineFor({ type: 'streak', name, team: teamNick, n: ctx.streak }, r) })
      else if (ctx.skid >= 3 && ctx.skid % 2 === 1) D.headlines.push({ at: k, text: headlineFor({ type: 'skid', name, team: teamNick, n: ctx.skid }, r) })
      else if (BIG_GAME[pos]?.(g)) D.headlines.push({ at: k, text: headlineFor({ type: 'big', name, team: teamNick, opp, label: GAME_LINE[pos]?.(g) ?? '' }, r) })
      else if (!g.won && BUST_GAME[pos]?.(g)) D.headlines.push({ at: k, text: headlineFor({ type: 'bust', name, team: teamNick, opp }, r) })
    }
    for (const f of fresh) D.headlines.push({ at: k, text: headlineFor({ type: f.record ? 'record' : 'milestone', name, team: teamNick, label: f.label }, r) })
    const need = isBucket ? 50 : 10, left = total - k
    if (!D.seen.has('clinch') && ctx.wins >= need) { D.seen.add('clinch'); D.headlines.push({ at: k, text: headlineFor({ type: 'clinch', name, team: teamNick }, r) }) }
    if (!D.seen.has('out') && ctx.wins + left < (isBucket ? 38 : 8)) { D.seen.add('out'); D.headlines.push({ at: k, text: headlineFor({ type: 'out', name, team: teamNick }, r) }) }
    return fresh
  }

  // ── Totals from the spliced games ──────────────────────────────────────────
  D.totals = (games = D.games) => {
    const out = {}
    const map = COUNTS[sport]?.[pos] ?? {}
    for (const [sk, gk] of Object.entries(map)) out[sk] = games.reduce((s, g) => s + (g[gk] ?? 0), 0)
    const wins = games.filter(g => g.won).length
    out.wins = wins; out.losses = games.length - wins
    if (!isBucket) {
      if (pos === 'rb') { out.seasonYPC = out.seasonCarries > 0 ? Math.round((out.seasonRushYds / out.seasonCarries) * 10) / 10 : 0; out.seasonLong = Math.max(0, ...games.map(g => g.long ?? 0)); out.hundredYardGames = games.filter(g => g.rushYds >= 100).length }
      if (pos === 'wr' || pos === 'te') { out.seasonYPR = out.seasonRecs > 0 ? Math.round((out.seasonRecYds / out.seasonRecs) * 10) / 10 : 0; out.seasonLong = Math.max(0, ...games.map(g => g.long ?? 0)); out.hundredYardGames = games.filter(g => g.recYds >= 100).length; out.catchRate = out.seasonTargets > 0 ? Math.round((out.seasonRecs / out.seasonTargets) * 1000) / 10 : 0 }
      if (pos === 'qb') out.seasonINTs = Math.max(3, out.seasonINTs)
    } else {
      out.gameLog = games.map(g => (g.won ? 'W' : 'L'))
    }
    const score = BEST[pos] ?? (g => g.won ? 1 : 0)
    out.bestGame = [...games].filter(g => !g.sat).sort((a, b) => score(b) - score(a))[0] ?? games[0]
    if (!isBucket) out.highlights = games.filter(g => g.wk <= 4 || g.wk >= 14)
    return out
  }

  // ── Finalize: playoffs from a run that matches the record ──────────────────
  D.finalize = () => {
    if (D.finalized) return D.final
    const t = D.totals()
    const want = t.wins
    const mods = addMods(D.cum, D.playoffMods)
    let bestRun = D.last, bestGap = Math.abs(D.last.wins - want)
    for (let i = 0; i < 48 && bestGap > 0; i++) {
      const run = runWith(mods, `po-${i}`)
      const gap = Math.abs(run.wins - want)
      if (gap < bestGap) { bestRun = run; bestGap = gap }
    }
    D.final = {
      ...bestRun, ...t, games: D.games,
      story: { moments: D.moments, milestones: D.milestones, records: D.records.concat(seasonRecords(bestRun, t)), headlines: D.headlines, xp: D.xp, sat: D.sat.length },
    }
    if (!isBucket) D.final.hasBye = D.final.playoffs && bestRun.hasBye
    D.finalized = true
    return D.final
  }
  function seasonRecords(run, t) {
    const out = []
    for (const rec of recs) if (rec.stat && (t[rec.stat] ?? run[rec.stat] ?? 0) > rec.value) out.push({ ...rec, got: t[rec.stat] ?? run[rec.stat] })
    for (const rec of RECORDS[sport]?.team ?? []) if (rec.statFn?.({ ...run, ...t })) out.push({ ...rec, got: `${t.wins}-${t.losses}` })
    return out
  }
  return D
}
