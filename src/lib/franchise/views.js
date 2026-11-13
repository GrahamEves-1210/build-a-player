// FRANCHISE: the rest of what the screens read (API.md section 2). Pure functions of the league.
import { REG_WEEKS, PLAYOFF_ROUNDS, TRADE_DEADLINE, DEV, SLOTS, OL_SPOTS, weekLabel, clamp, r1, r2, slotOf, gradeOf } from './consts'
import { TEAM_SHORTS, teamRating, ranks, recText, pct, nick, teamName, ordinal } from './core'
import { teamRef, playerRow, depthMap, coachRow, playcall, moodWord, injView, coachOvr } from './rows'
import { payroll, cutCost, marketValue, marketYears, marketGuar, optionSalary, moneyText } from './money'
import { lineupOf, startersOf } from './depth'
import { TYPES_OF, traitLabel, lastName, archOf } from './players'
import { statView, statLine, histStats, passerRating, LEADER_CATS, num } from './stats'
import { standing, clinches, finishText } from './standings'
import { DIVISIONS, DIV_OF, CONF_OF, CONFS } from './schedule'
import { gameRow, weekGames, schedule, recordOf, staff, staffEffects } from './select'
import { upgradeCost } from './dev'
import { FADE } from '../careerAging'
import { moodOf, userGame, powerBlurb } from './season'
import { races, AWARD_NAME } from './awards'
import { goalState, securityWord, SECURITY_FLOOR, startOwner } from './owner'
import { playerValue, pickValue, pickKey, judge, tradesOpen, offerText } from './trades'
import { lineText } from './week'
import { buildProfile } from './profile'
import { streetAsk } from './roster'
import { coachAsk } from './league'
import { COACH_LABEL } from './coachData'
import { STATE_LABEL, directionOf, directionRead, advice } from './state'
import { pickWhen } from './trades'

// ── Box scores ───────────────────────────────────────────────────────────────
const topTime = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
function teamBox(F, raw, side) {
  const short = side === 0 ? raw.h : raw.a, box = raw.box[side] ?? {}, tot = raw.tot[side]
  const rows = Object.entries(box).map(([id, s]) => ({ p: F.players[id], s })).filter(x => x.p)
  const who = x => ({ id: x.p.id, name: x.p.name, slot: slotOf(x.p), built: !!x.p.built })
  const n = (s, k) => s[k] ?? 0
  return {
    team: teamRef(short), score: raw.sc[side], quarters: raw.qs[side],
    totals: { plays: tot.plays, yds: tot.yds, passYds: tot.py, rushYds: tot.ry, firstDowns: tot.fd, third: `${tot.d3c}-${tot.d3a}`, fourth: `${tot.d4c}-${tot.d4a}`, to: tot.to, sacks: tot.sk, pen: tot.pen, penYds: tot.peny, top: topTime(tot.top) },
    passing: rows.filter(x => n(x.s, 'pa') > 0).sort((a, b) => n(b.s, 'pa') - n(a.s, 'pa')).map(x => ({ ...who(x), cmp: n(x.s, 'pc'), att: n(x.s, 'pa'), yds: n(x.s, 'py'), td: n(x.s, 'ptd'), int: n(x.s, 'pi'), sk: n(x.s, 'sk'), rtg: passerRating(x.s) })),
    rushing: rows.filter(x => n(x.s, 'ra') > 0).sort((a, b) => n(b.s, 'ry') - n(a.s, 'ry')).map(x => ({ ...who(x), att: n(x.s, 'ra'), yds: n(x.s, 'ry'), td: n(x.s, 'rtd'), long: n(x.s, 'rl') })),
    receiving: rows.filter(x => n(x.s, 'tg') > 0).sort((a, b) => n(b.s, 'cy') - n(a.s, 'cy') || n(b.s, 'rc') - n(a.s, 'rc')).map(x => ({ ...who(x), tgt: n(x.s, 'tg'), rec: n(x.s, 'rc'), yds: n(x.s, 'cy'), td: n(x.s, 'ctd'), long: n(x.s, 'cl') })),
    defense: rows.filter(x => n(x.s, 'tk') + n(x.s, 'sa') + n(x.s, 'di') + n(x.s, 'pd') + n(x.s, 'ff') > 0 && ['dl', 'lb', 'db'].includes(x.p.pos)).sort((a, b) => n(b.s, 'tk') + n(b.s, 'sa') * 3 + n(b.s, 'di') * 4 - n(a.s, 'tk') - n(a.s, 'sa') * 3 - n(a.s, 'di') * 4).map(x => ({ ...who(x), tkl: n(x.s, 'tk'), sack: n(x.s, 'sa'), tfl: n(x.s, 'tfl'), int: n(x.s, 'di'), pd: n(x.s, 'pd'), ff: n(x.s, 'ff') })),
    kicking: rows.filter(x => n(x.s, 'fga') + n(x.s, 'xpa') > 0).map(x => ({ ...who(x), fgm: n(x.s, 'fgm'), fga: n(x.s, 'fga'), long: n(x.s, 'fgl'), xpm: n(x.s, 'xpm'), xpa: n(x.s, 'xpa'), pts: n(x.s, 'fgm') * 3 + n(x.s, 'xpm') })),
  }
}
export function boxView(F, raw) {
  if (!raw) return null
  return { id: raw.id, week: raw.week, home: teamBox(F, raw, 0), away: teamBox(F, raw, 1), ot: !!raw.ot, scoring: raw.scoring ?? [] }
}
export const boxScore = (F, gameId) => boxView(F, F.boxes?.[gameId] ?? null)

// ── Units and ranks ──────────────────────────────────────────────────────────
export function unitRanks(F) {
  const have = TEAM_SHORTS.some(s => F.teams[s].st?.g)
  const vals = {}
  if (have) {
    const per = (s, k) => { const st = F.teams[s].st; return st && st.g ? st[k] / st.g : 0 }
    for (const [k, src] of [['passOff', 'py'], ['rushOff', 'ry'], ['passDef', 'pyA'], ['rushDef', 'ryA'], ['ptsFor', 'pf'], ['ptsAgainst', 'pa']]) vals[k] = Object.fromEntries(TEAM_SHORTS.map(s => [s, per(s, src)]))
  } else {
    // before a game is played: what each unit projects to, read off the men who would line up (projected: true)
    const P = Object.fromEntries(TEAM_SHORTS.map(s => [s, buildProfile(F, s, false)]))
    const idx = {
      passOff: T => (T.qb?.s.comp ?? 0.4) * 0.45 + (T.qb?.s.deep ?? 0.4) * 0.15 + (T.recv.slice(0, 4).reduce((a, r) => a + (r.s.catch ?? 0.5) + (r.s.ypr ?? 0.5), 0) / 8) * 0.25 + T.olPass * 0.15,
      rushOff: T => (T.rbs[0]?.s.run ?? 0.4) * 0.5 + T.olRun * 0.4 + (T.qb?.s.legs ?? 0.3) * 0.1,
      passDef: T => T.cover * 0.6 + T.passRush * 0.4, rushDef: T => T.runD,
    }
    const raw = Object.fromEntries(Object.entries(idx).map(([k, f]) => [k, Object.fromEntries(TEAM_SHORTS.map(s => [s, f(P[s])]))]))
    const mean = k => TEAM_SHORTS.reduce((a, s) => a + raw[k][s], 0) / 32
    const m = Object.fromEntries(Object.keys(idx).map(k => [k, mean(k)]))
    vals.passOff = Object.fromEntries(TEAM_SHORTS.map(s => [s, 219 + (raw.passOff[s] - m.passOff) * 330]))
    vals.rushOff = Object.fromEntries(TEAM_SHORTS.map(s => [s, 117 + (raw.rushOff[s] - m.rushOff) * 240]))
    vals.passDef = Object.fromEntries(TEAM_SHORTS.map(s => [s, 219 - (raw.passDef[s] - m.passDef) * 330]))
    vals.rushDef = Object.fromEntries(TEAM_SHORTS.map(s => [s, 117 - (raw.rushDef[s] - m.rushDef) * 260]))
    vals.ptsFor = Object.fromEntries(TEAM_SHORTS.map(s => [s, 22.5 + (raw.passOff[s] - m.passOff) * 42 + (raw.rushOff[s] - m.rushOff) * 18]))
    vals.ptsAgainst = Object.fromEntries(TEAM_SHORTS.map(s => [s, 22.5 - (raw.passDef[s] - m.passDef) * 42 - (raw.rushDef[s] - m.rushDef) * 18]))
  }
  const low = { passDef: true, rushDef: true, ptsAgainst: true }
  const rk = Object.fromEntries(Object.keys(vals).map(k => [k, ranks(vals[k], !!low[k])]))
  const out = {}
  for (const s of TEAM_SHORTS) out[s] = Object.fromEntries(Object.keys(vals).map(k => [k, { rank: rk[k][s], val: r1(vals[k][s]), projected: !have }]))
  return out
}
export function teamStats(F) {
  const U = unitRanks(F)
  return TEAM_SHORTS.map(s => {
    const st = F.teams[s].st ?? { g: 0 }, g = Math.max(1, st.g), v = k => r1((st[k] ?? 0) / g)
    return { team: teamRef(s), g: st.g ?? 0, ptsFor: v('pf'), ptsAgainst: v('pa'), yds: v('yds'), passYds: v('py'), rushYds: v('ry'), ydsAllowed: v('ydsA'), passYdsAllowed: v('pyA'), rushYdsAllowed: v('ryA'), to: st.to ?? 0, takeaways: st.tk ?? 0, sacks: st.sk ?? 0, sacksAllowed: st.skA ?? 0, ranks: Object.fromEntries(Object.entries(U[s]).map(([k, x]) => [k, x.rank])) }
  })
}

// ── Standings ────────────────────────────────────────────────────────────────
function standRows(F) {
  const S = standing(F), C = clinches(F, S), rows = {}
  for (const s of TEAM_SHORTS) {
    const r = S.R[s], conf = CONF_OF[s], seed = S.seeds[conf].indexOf(s)
    const l5 = r.l5, w5 = [...l5].filter(c => c === 'W').length, l5l = [...l5].filter(c => c === 'L').length
    rows[s] = { team: teamRef(s), w: r.w, l: r.l, t: r.t, pct: Math.round(pct(r.w, r.l, r.t) * 1000) / 1000, pf: r.pf, pa: r.pa, diff: r.pf - r.pa, div: `${r.dw}-${r.dl}${r.dt ? `-${r.dt}` : ''}`, conf: `${r.cw}-${r.cl}${r.ct ? `-${r.ct}` : ''}`,
      home: `${r.hw}-${r.hl}${r.ht ? `-${r.ht}` : ''}`, away: `${r.aw}-${r.al}${r.at ? `-${r.at}` : ''}`, streak: r.strk > 0 ? `W${r.strk}` : r.strk < 0 ? `L${-r.strk}` : '-', last5: `${w5}-${l5l}`, seed: seed >= 0 ? seed + 1 : null, clinch: C[s] ?? null, user: s === F.team }
  }
  return { S, rows }
}
export function standings(F) {
  const { S, rows } = standRows(F)
  return { divisions: DIVISIONS.map(d => ({ name: d.name, conf: d.conf, teams: S.divisions[d.name].map(s => rows[s]) })), conferences: Object.fromEntries(CONFS.map(c => [c, S.conf[c].map(s => rows[s])])) }
}
export function playoffPicture(F) {
  const { S, rows } = standRows(F), out = {}
  const po = F.playoffs
  for (const c of CONFS) {
    const seeds = po ? po.seeds[c] : S.seeds[c]
    out[c] = { seeds: seeds.map((s, i) => ({ ...rows[s], seed: i + 1 })), hunt: S.conf[c].filter(s => !seeds.includes(s)).slice(0, 5).map(s => rows[s]) }
  }
  out.bracket = po ? {
    rounds: PLAYOFF_ROUNDS.map(r => ({ id: r.id, name: r.name, games: (F.sched.weeks[r.week - 1] ?? []).map((g, i) => {
      const c = g.conf ?? null, seed = s => (po.seeds[CONF_OF[s]].indexOf(s) + 1)
      return { id: `w${r.week}g${i}`, home: teamRef(g.h), away: teamRef(g.a), hs: g.hs ?? null, as: g.as ?? null, played: g.hs != null, winner: g.hs == null ? null : g.hs > g.as ? g.h : g.a, seeds: [seed(g.h), seed(g.a)], conf: c }
    }) })),
    champion: po.champion ? teamRef(po.champion) : null,
  } : null
  return out
}

// ── Leaders, races ───────────────────────────────────────────────────────────
export function leaders(F, top = 10) {
  const P = Object.values(F.players).filter(p => p.team && (p.s.g ?? 0) > 0), out = {}
  const g = Math.max(1, ...TEAM_SHORTS.map(s => F.teams[s].st?.g ?? 0))
  const dm = {}
  const row = p => playerRow(F, p, (dm[p.team] ??= depthMap(F, F.teams[p.team])))
  for (const [k, c] of Object.entries(LEADER_CATS)) {
    const list = []
    for (const p of P) {
      if (c.pos && !c.pos.includes(p.pos)) continue
      const v = c.v(p.s)
      if (!(v > 0) || (list.length >= top && v <= list[list.length - 1].v) || (c.min && !c.min(p.s, g))) continue
      let i = list.length
      while (i > 0 && (list[i - 1].v < v || (list[i - 1].v === v && list[i - 1].p.id > p.id))) i--
      list.splice(i, 0, { p, v })
      if (list.length > top) list.pop()
    }
    out[k] = list.map((x, i) => ({ rank: i + 1, player: row(x.p), val: x.v, text: k === 'rating' ? x.v.toFixed(1) : num(x.v) }))
  }
  return out
}
export const LEADER_LABELS = Object.fromEntries(Object.entries(LEADER_CATS).map(([k, c]) => [k, c.label]))
export function awardRaces(F) {
  const R = races(F), out = {}
  for (const k in R) out[k] = R[k].map((x, i) => ({ rank: i + 1, player: x.p ? playerRow(F, x.p) : null, coach: x.coach ? coachRow(F, x.coach, 'HC') : null, team: teamRef(x.short), line: x.line, share: x.share }))
  return out
}

// ── News, transactions, power rankings ──────────────────────────────────────
export const news = (F, n = 30) => F.news.slice(0, n).map(x => ({ id: x.id, year: x.y, week: x.w, kind: x.kind, head: x.head, ...(x.body && { body: x.body }), ...(x.team && { team: teamRef(x.team) }), ...(x.pid != null && { pid: x.pid }) }))
export const transactions = (F, n = 60, team = null) => F.tx.filter(x => !team || x.team === team).slice(0, n).map(x => ({ id: x.id, year: x.y, week: x.w, type: x.type, team: teamRef(x.team), text: x.text, ...(x.pid != null && { pid: x.pid }) }))
export const powerRankings = F => (F.power ?? []).map(x => ({ rank: x.r, prev: x.p, move: x.p - x.r, team: teamRef(x.s), record: recordOf(F, x.s).text, blurb: powerBlurb(F, x), rating: x.v, state: F.teams[x.s].state ?? 'retool', stateLabel: STATE_LABEL[F.teams[x.s].state ?? 'retool'] }))

// ── The owner ────────────────────────────────────────────────────────────────
export function ownerView(F) {
  if (!F.owner) startOwner(F)
  const final = F.phase === 'offseason'
  return { goals: F.owner.goals.map(g => ({ id: g.id, text: g.text, weight: g.weight, ...goalState(F, g, final) })), security: Math.round(F.gm.security), word: securityWord(F.gm.security), verdict: F.owner.verdict?.text ?? null, floor: SECURITY_FLOOR }
}

// ── A player ─────────────────────────────────────────────────────────────────
const bodyText = p => (p.ht ? `${Math.floor(p.ht / 12)}'${p.ht % 12}" · ${p.wt}` : '')
const DEV_TEXT = ['Normal development: he earns XP at the standard rate.', 'Star development: he earns XP 40% faster.', 'Superstar development: he earns XP at nearly twice the standard rate.', 'Elite development: he earns XP at more than two and a half times the standard rate.']
export function askOf(F, p) {
  const mv = marketValue(p, F.cap)
  const k = p.drives?.includes('MONEY') ? 1.06 : p.drives?.includes('LOYAL') && p.team === F.team ? 0.93 : 1
  return { years: marketYears(p), perYear: r2(Math.max(mv * k, p.exp >= 3 ? 1.25 : 0.9)), guaranteed: r2(marketGuar(p)) }
}
export function playerCard(F, pid) {
  const p = F.players[pid]
  if (!p) return null
  const row = playerRow(F, p), mineP = p.team === F.team, fade = FADE.nfl[p.pos] ?? {}
  const con = p.con
  const draft = p.draft ? `${p.draft[0]} · Round ${p.draft[1]}, Pick ${p.draft[2]} (${p.draft[3]})` : p.gen || p.built ? (p.built ? null : 'Undrafted') : null
  const mood = p.team ? moodOf(F, p) : { why: [] }
  return {
    ...row, ht: p.ht ?? null, wt: p.wt ?? null, bodyText: bodyText(p), college: p.college ?? null, draft,
    traits: TYPES_OF[p.pos].map(t => ({ key: t, ...traitLabel(p.pos, t), val: p.a[t], grade: gradeOf(p.a[t]), cost: mineP ? upgradeCost(p.a[t]) : null, fading: !!fade[t] && p.age >= fade[t][1] })),
    devText: p.devKnown ? DEV_TEXT[p.dev] : 'The staff has not seen enough of him yet to know how fast he will develop.',
    contract: con ? { salary: con.sal, yrs: con.yrs, guar: con.guar, rookie: !!con.rookie, option: con.opt === 1 ? 'available' : con.opt === 2 ? 'exercised' : null, tag: !!con.tag, capHit: con.sal, cut: cutCost(p), ask: con.yrs <= 1 ? askOf(F, p) : null, extension: p.ext ? { years: p.ext.yrs, perYear: p.ext.sal } : null }
      : { salary: 0, yrs: 0, guar: 0, rookie: false, option: null, tag: false, capHit: 0, cut: { dead: 0, saves: 0 }, ask: askOf(F, p), extension: null },
    moodFactors: mood.why,
    stats: { season: statView(p.pos, p.s), career: statView(p.pos, p.car), byYear: (p.hist ?? []).map(h => ({ year: h[0], team: h[1], ...statView(p.pos, histStats(p.pos, h)) })) },
    awards: (p.aw ?? []).map(([year, code]) => ({ year, name: AWARD_NAME[code] ?? code })).sort((a, b) => b.year - a.year),
    value: playerValue(F, p), canUpgrade: mineP && (p.pts ?? 0) > 0 && TYPES_OF[p.pos].some(t => upgradeCost(p.a[t]) != null && upgradeCost(p.a[t]) <= p.pts), mine: mineP, onBlock: !!p.block,
  }
}
export function injuryReport(F, team = F.team) {
  const t = F.teams[team], dm = depthMap(F, t)
  return t.roster.map(id => F.players[id]).filter(p => p && p.inj && (p.inj.wk > 0 || p.inj.q || p.inj.nag)).map(p => ({ ...playerRow(F, p, dm), what: p.inj.what, wk: p.inj.wk, status: injView(p).status })).sort((a, b) => b.ovr - a.ovr)
}
// how set a team is at each spot: the starter against the league's starters there, and who is behind him
export function teamNeeds(F, team = F.team) {
  const all = {}
  for (const s of TEAM_SHORTS) {
    const L = lineupOf(F, F.teams[s])
    for (const sl of SLOTS) {
      if (!sl.pos) continue
      const list = sl.pos === 'ol' ? [L.OL.find(o => o.spot === sl.slot)?.p].filter(Boolean) : L[sl.slot]
      ;(all[sl.slot] ??= {})[s] = { start: list.slice(0, sl.n), next: list[sl.n] ?? null }
    }
  }
  const out = []
  for (const sl of SLOTS) {
    if (!sl.pos) continue
    const mineS = all[sl.slot][team], val = Object.fromEntries(TEAM_SHORTS.map(s => [s, avgOvr(all[sl.slot][s].start, sl.n)]))
    const rk = ranks(val)[team], ovr = Math.round(val[team]), next = mineS.next
    const oldest = Math.max(0, ...mineS.start.map(p => p.age))
    const level = ovr < 72 || rk >= 28 ? 3 : ovr < 76 || rk >= 21 ? 2 : (!next || next.ovr < 66) && sl.pos !== 'ol' && sl.slot !== 'K' && sl.slot !== 'QB' ? 1 : oldest >= 32 && sl.slot !== 'K' && sl.slot !== 'QB' ? 1 : 0
    out.push({ slot: sl.slot, level, word: ['SET', 'DEPTH', 'NEED', 'URGENT'][level], starter: mineS.start[0] ? playerRow(F, mineS.start[0]) : null, ovr, rank: rk })
  }
  return out.sort((a, b) => b.level - a.level || b.rank - a.rank)
}
const avgOvr = (list, n) => { let s = 0; for (let i = 0; i < n; i++) s += list[i]?.ovr ?? 60; return s / n }

// ── A team ───────────────────────────────────────────────────────────────────
// (text never names a year that has not been played: "Round 2, the next draft")
const pickRow = (F, pk, owner) => ({ key: pickKey(pk), year: pk.y, round: pk.r, orig: teamRef(pk.o), own: pk.o === owner, value: pickValue(F, pk), when: pickWhen(F, pk), text: `Round ${pk.r}, ${pickWhen(F, pk)}${pk.o !== owner ? ` (via ${pk.o})` : ''}` })
export function teamInfo(F, short) {
  const t = F.teams[short]
  if (!t) return null
  const all = Object.fromEntries(TEAM_SHORTS.map(s => [s, teamRating(F, F.teams[s])]))
  const offR = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, all[s].off]))), defR = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, all[s].def])))
  const S = standing(F), conf = CONF_OF[short], seed = S.seeds[conf].indexOf(short), place = S.divisions[DIV_OF[short]].indexOf(short) + 1
  return { ...teamRef(short), record: recordOf(F, short).text, standing: `${ordinal(place)} in the ${DIV_OF[short]}`, seed: seed >= 0 ? seed + 1 : null,
    ratings: { ...all[short], offRank: offR[short], defRank: defR[short] }, units: unitRanks(F)[short], staff: staff(F, short), state: t.state ?? 'retool', stateLabel: STATE_LABEL[t.state ?? 'retool'], window: t.win ?? 1, strategy: t.state ?? 'retool', capSpace: r2(F.cap - payroll(F, t)),
    picks: [...t.picks].sort((a, b) => a.y - b.y || a.r - b.r).map(pk => pickRow(F, pk, short)), user: short === F.team }
}
export function coachCard(F, id) {
  const c = F.coaches[id]
  if (!c) return null
  const role = c.team ? (['hc', 'oc', 'dc'].find(k => F.teams[c.team].staff[k] === c.id) ?? c.role.toLowerCase()).toUpperCase() : c.role
  const word = v => (v >= 9 ? 'Elite' : v >= 7.5 ? 'Strong' : v >= 5.5 ? 'Solid' : v >= 4 ? 'Below average' : 'Poor')
  const eff = [
    `${COACH_LABEL.talentDev}: ${word(c.a.talentDev)}. Moves how fast players earn XP and how often young players break out.`,
    `${COACH_LABEL.offPlaycalling}: ${word(c.a.offPlaycalling)}. ${role === 'DC' ? 'Not his side of the ball.' : 'Moves the offense on every snap.'}`,
    `${COACH_LABEL.defPlaycalling}: ${word(c.a.defPlaycalling)}. ${role === 'OC' ? 'Not his side of the ball.' : 'Moves the defense on every snap.'}`,
    `${COACH_LABEL.culture}: ${word(c.a.culture)}. Moves morale, holdouts and how free agents see the team${role === 'HC' ? '' : ' (the head coach\'s counts)'}.`,
    `${COACH_LABEL.situational}: ${word(c.a.situational)}. Moves fourth downs, two-point tries, the clock and close games${role === 'HC' ? '' : ' (the head coach\'s counts)'}.`,
  ]
  return { ...coachRow(F, c, role), history: (c.hist ?? []).map(h => ({ year: h[0], team: h[1], role: h[2], w: h[3], l: h[4], note: h[5] ?? null })), effects: eff, ask: { years: c.age >= 62 ? 2 : 4, salary: coachAsk(c, role) }, interest: c.team ? null : coachInterest(F, c) }
}
// how a coach on the market sees the user's job, 0-100
export function coachInterest(F, c) {
  const t = F.teams[F.team], r = t.rec ?? { w: 8, l: 9, t: 0 }
  const roster = ranks(Object.fromEntries(TEAM_SHORTS.map(s => [s, teamRating(F, F.teams[s]).ovr])))[F.team]
  return clamp(Math.round(52 + (17 - roster) * 1.4 + (pct(r.w, r.l, r.t) - 0.5) * 30 + (F.gm.rings ?? 0) * 5 + (F.gm.security - 50) * 0.2), 5, 99)
}

// ── Hub ──────────────────────────────────────────────────────────────────────
const KIND_OF_WEEK = w => (w <= REG_WEEKS ? 'regular' : PLAYOFF_ROUNDS.find(r => r.week === w)?.id ?? 'regular')
export function weekTasks(F) {
  if (F.phase === 'offseason') return []
  const out = [], ug = userGame(F), t = F.teams[F.team], U = unitRanks(F)
  const P = t.roster.map(id => F.players[id]).filter(Boolean)
  if (ug) {
    const opp = ug.g.h === F.team ? ug.g.a : ug.g.h, u = U[opp]
    out.push({ id: 'gameplan', kind: 'gameplan', title: 'GAMEPLAN', detail: `${ug.g.h === F.team ? 'vs' : 'at'} ${opp}: ${ordinal(u.passDef.rank)} pass defense, ${ordinal(u.rushDef.rank)} run defense`, done: !!F.done?.gameplan })
  }
  out.push({ id: 'practice', kind: 'practice', title: 'PRACTICE', detail: `${{ full: 'Full pads', half: 'Half pads', walk: 'Walkthrough' }[F.practice?.intensity ?? 'half']}${F.practice?.focus?.length ? `, ${F.practice.focus.length} focus player${F.practice.focus.length > 1 ? 's' : ''}` : ', no focus players'}`, done: !!F.done?.practice })
  for (const o of F.office) out.push({ id: o.id, kind: 'office', title: o.title, detail: o.body, done: false })
  const pts = P.filter(p => (p.pts ?? 0) > 0)
  if (pts.length) out.push({ id: 'upgrades', kind: 'upgrades', title: 'UPGRADES', detail: `${pts.reduce((s, p) => s + p.pts, 0)} point${pts.reduce((s, p) => s + p.pts, 0) === 1 ? '' : 's'} to spend on ${pts.length} player${pts.length > 1 ? 's' : ''}`, done: false, count: pts.length })
  const starters = startersOf(F, t)
  const hurt = P.filter(p => p.inj && p.inj.wk > 0 && p.ovr >= 76).sort((a, b) => b.ovr - a.ovr)
  if (hurt.length) out.push({ id: 'injury', kind: 'injury', title: 'INJURIES', detail: `${hurt.slice(0, 2).map(p => `${p.name} (${p.inj.wk === 1 ? '1 week' : p.inj.season ? 'season' : `${p.inj.wk} weeks`})`).join(', ')}${hurt.length > 2 ? ` and ${hurt.length - 2} more` : ''}`, done: !!F.done?.injury, count: hurt.length })
  if ((F.draft?.pts ?? 0) > 0) out.push({ id: 'scout', kind: 'scout', title: 'SCOUTING', detail: `${F.draft.pts} scouting point${F.draft.pts === 1 ? '' : 's'} to spend on the ${F.draft.year} class`, done: false, count: F.draft.pts })
  const adv = advice(F), dir = directionOf(F)
  if (F.phase === 'regular' && F.week <= TRADE_DEADLINE && F.gm.dirAt !== F.year) out.push({ id: 'direction', kind: 'direction', title: `DIRECTION: ${STATE_LABEL[dir]}`, detail: `${directionRead(F, dir).text} It can be changed once before the deadline (Week ${TRADE_DEADLINE}).`, done: true })
  if (adv.length) out.push({ id: 'advice', kind: 'advice', title: 'FROM THE STAFF', detail: adv[0], done: true, count: adv.length })
  const prob = rosterIssues(F)
  if (prob.length) out.push({ id: 'roster', kind: 'roster', title: 'ROSTER', detail: prob[0], done: false, count: prob.length })
  void starters
  return out
}
export function rosterIssues(F) {
  const t = F.teams[F.team], out = [], c = {}
  let active = 0
  for (const id of t.roster) { const p = F.players[id]; if (!p) continue; if (!p.inj?.ir) active++; const g = p.pos === 'ol' ? 'OL' : slotOf(p); c[g] = (c[g] ?? 0) + 1 }
  const limit = F.phase === 'offseason' ? 62 : 46
  if (active > limit) out.push(`${active} on the active roster: ${active - limit} over the limit of ${limit}`)
  const MIN = { QB: 2, RB: 3, WR: 5, TE: 2, OL: 7, EDGE: 3, DT: 3, LB: 4, CB: 3, S: 3, K: 1 }
  for (const g in MIN) if ((c[g] ?? 0) < MIN[g]) out.push(`Short at ${g}: ${c[g] ?? 0} on the roster, ${MIN[g]} needed`)
  if (F.settings.cap && payroll(F, t) > F.cap + 0.001) out.push(`${moneyText(r2(payroll(F, t) - F.cap))} over the cap`)
  return out
}
export function hub(F) {
  const t = F.teams[F.team], rec = recordOf(F, F.team), ug = userGame(F), off = F.phase === 'offseason'
  const S = standing(F), conf = CONF_OF[F.team], seed = (F.playoffs ? F.playoffs.seeds[conf] : S.seeds[conf]).indexOf(F.team)
  const place = S.divisions[DIV_OF[F.team]].indexOf(F.team) + 1
  const out = F.playoffs?.out?.[F.team]
  let next = null
  if (ug) { const home = ug.g.h === F.team, opp = home ? ug.g.a : ug.g.h; next = { week: F.week, label: weekLabel(F.week), opp: teamRef(opp), home, oppRecord: recordOf(F, opp).text, bye: false, kind: KIND_OF_WEEK(F.week), eliminated: false, neutral: !!ug.g.neutral } }
  else if (!off) next = { week: F.week, label: weekLabel(F.week), opp: null, home: false, oppRecord: null, bye: F.phase === 'regular', kind: KIND_OF_WEEK(F.week), eliminated: F.phase === 'playoffs' }
  const lastRow = [...schedule(F)].reverse().find(g => g.result)
  const stage = off ? F.off?.stage ?? F.stage : null
  return {
    phase: F.phase, year: F.year, week: F.week, weekLabel: off ? 'OFFSEASON' : weekLabel(F.week), team: teamRef(F.team),
    gm: { name: F.gm.name, security: Math.round(F.gm.security), securityWord: securityWord(F.gm.security), record: `${F.gm.w + (off ? 0 : rec.w)}-${F.gm.l + (off ? 0 : rec.l)}`, rings: F.gm.rings },
    record: rec, standing: `${ordinal(place)} in the ${DIV_OF[F.team]}`, seed: seed >= 0 ? seed + 1 : null,
    next, bye: !off && !ug && F.phase === 'regular', tasks: weekTasks(F),
    primary: off ? { action: 'stage', label: 'CONTINUE' } : ug ? { action: 'play', label: `PLAY ${weekLabel(F.week)}` } : { action: 'advance', label: F.phase === 'playoffs' ? `SIM THE ${weekLabel(F.week)}` : 'ADVANCE THE BYE WEEK' },
    lastGame: lastRow ? { week: lastRow.week, opp: lastRow.opp, home: lastRow.home, ...lastRow.result } : null,
    headlines: news(F, 5), cap: { space: r2(F.cap - payroll(F, t)), payroll: payroll(F, t), cap: F.cap }, owner: ownerView(F), stage: stage ? { id: stage, name: stage } : null,
    eliminated: out ? finishText(F, F.team) : null, champion: F.playoffs?.champion === F.team,
    state: t.state ?? 'retool', stateLabel: STATE_LABEL[t.state ?? 'retool'], direction: directionOf(F), directionLabel: STATE_LABEL[directionOf(F)], advice: advice(F),
  }
}
export function pregame(F) {
  const ug = userGame(F)
  if (!ug) return null
  const g = ug.g, U = unitRanks(F), plan = F.plan ?? { off: 'balanced', def: 'balanced' }
  const hr = teamRating(F, F.teams[g.h]), ar = teamRating(F, F.teams[g.a])
  const spread = Math.round(((hr.ovr - ar.ovr) * 1.15 + (g.neutral ? 0 : 1.8)) * 2) / 2
  const inj = s => injuryReport(F, s).filter(p => p.ovr >= 72).slice(0, 8).map(p => ({ id: p.id, name: p.name, slot: p.slot, status: p.status, wk: p.wk }))
  const opp = g.h === F.team ? g.a : g.h, ou = U[opp], mu = U[F.team]
  const keys = []
  if (ou.passDef.rank >= 22) keys.push(`${nick(opp)} are ${ordinal(ou.passDef.rank)} against the pass.`)
  if (ou.rushDef.rank >= 22) keys.push(`${nick(opp)} are ${ordinal(ou.rushDef.rank)} against the run.`)
  if (ou.passOff.rank <= 8) keys.push(`Their passing game ranks ${ordinal(ou.passOff.rank)}.`)
  if (ou.rushOff.rank <= 8) keys.push(`Their run game ranks ${ordinal(ou.rushOff.rank)}.`)
  if (mu.ptsFor.rank <= 8) keys.push(`${nick(F.team)} are ${ordinal(mu.ptsFor.rank)} in scoring.`)
  const best = F.teams[opp].roster.map(id => F.players[id]).filter(p => p && !(p.inj && p.inj.wk > 0)).sort((a, b) => b.ovr - a.ovr)[0]
  if (best) keys.push(`${best.name} is the man to account for.`)
  return { week: F.week, label: weekLabel(F.week), kind: KIND_OF_WEEK(F.week), home: teamRef(g.h), away: teamRef(g.a), userHome: g.h === F.team, records: { home: recordOf(F, g.h).text, away: recordOf(F, g.a).text },
    venue: g.neutral ? 'Neutral site' : teamRef(g.h).city, weather: null, units: { home: U[g.h], away: U[g.a] }, injuries: { home: inj(g.h), away: inj(g.a) },
    gameplan: { off: { id: plan.off, label: planLabel('off', plan.off) }, def: { id: plan.def, label: planLabel('def', plan.def) } }, moments: !!F.settings.moments, calls: !!F.settings.calls,
    keys: keys.slice(0, 3), line: spread === 0 ? 'EVEN' : `${spread > 0 ? g.h : g.a} -${Math.abs(spread)}`, superBowl: g.rd === 'sb' }
}
const PLAN_LABEL = { off: { balanced: 'BALANCED', air: 'THROW TO WIN', ground: 'RUN TO WIN', quick: 'QUICK GAME', shots: 'TAKE SHOTS' }, def: { balanced: 'BALANCED', stopRun: 'STOP THE RUN', rush: 'BRING PRESSURE', cover: 'TAKE AWAY THE PASS', ball: 'GO FOR THE BALL' } }
export const planLabel = (side, id) => PLAN_LABEL[side][id] ?? 'BALANCED'
export function scoutingReport(F, opp = null) {
  const ug = userGame(F), short = opp ?? (ug ? (ug.g.h === F.team ? ug.g.a : ug.g.h) : null)
  if (!short) return null
  const u = unitRanks(F)[short], t = F.teams[short], good = [], bad = []
  const say = (rank, well, badly) => { if (rank <= 10) good.push(`${well} (${ordinal(rank)})`); else if (rank >= 23) bad.push(`${badly} (${ordinal(rank)})`) }
  say(u.passOff.rank, 'Throws the ball well', 'Struggles to throw it'); say(u.rushOff.rank, 'Runs the ball well', 'Cannot run the ball')
  say(u.passDef.rank, 'Hard to throw on', 'Can be thrown on'); say(u.rushDef.rank, 'Stops the run', 'Can be run on'); say(u.ptsAgainst.rank, 'Keeps teams off the board', 'Gives up points')
  const stars = t.roster.map(id => F.players[id]).filter(p => p && !(p.inj && p.inj.wk > 0)).sort((a, b) => b.ovr - a.ovr).slice(0, 3)
  const st = staff(F, short)
  return { opp: teamRef(short), record: recordOf(F, short).text, units: u, strengths: good, weaknesses: bad, stars: stars.map(p => playerRow(F, p)), staff: { hc: st.hc, oc: st.oc, dc: st.dc } }
}
export function lastWeek(F) {
  const L = F.last
  if (!L) return null
  const row = id => playerRow(F, F.players[id])
  const u = L.user
  return {
    week: L.week, year: L.year, label: L.label,
    user: u ? { game: gameRow(F, F.sched.weeks[L.week - 1]?.[+u.gameId.split('g')[1]] ?? { h: F.team, a: u.opp }, L.week, +u.gameId.split('g')[1]), box: boxScore(F, u.gameId), won: u.won, tied: u.tied, us: u.us, them: u.them, ot: u.ot, opp: teamRef(u.opp), home: u.home,
      potg: u.potg && F.players[u.potg.id] ? { player: row(u.potg.id), line: u.potg.line } : null, xp: u.xp.slice(0, 12), moments: u.moments, calls: u.calls } : null,
    injuries: L.injuries, scores: (F.sched.weeks[L.week - 1] ?? []).map((g, i) => gameRow(F, g, L.week, i)), headlines: news(F, 8).filter(x => x.week === L.week || x.week === 0),
    awards: L.awards, moves: L.moves ?? [], standing: hub(F).standing,
  }
}

// ── Trades and free agents ───────────────────────────────────────────────────
export function tradeAssets(F, team) {
  const t = F.teams[team]
  if (!t) return { players: [], picks: [] }
  const dm = depthMap(F, t)
  return { players: t.roster.map(id => F.players[id]).filter(Boolean).map(p => ({ ...playerRow(F, p, dm), value: playerValue(F, p) })).sort((a, b) => b.value - a.value), picks: [...t.picks].sort((a, b) => a.y - b.y || a.r - b.r).map(pk => pickRow(F, pk, team)) }
}
export const tradeVerdict = (F, offer) => judge(F, { ...(offer ?? {}), from: offer?.from ?? F.team })
const offerRow = (F, o) => ({ id: o.id, from: o.from, to: o.to, give: o.give, get: o.get, text: offerText(F, o), fromTeam: teamRef(o.from) })
export function tradeBlock(F) {
  const mineP = F.teams[F.team].roster.map(id => F.players[id]).filter(p => p?.block)
  const league = []
  for (const s of TEAM_SHORTS) {
    if (s === F.team) continue
    const t = F.teams[s]
    // a rebuilding team sells its veterans; a contender that has turned seller listens on the ones on short deals
    for (const id of t.roster) { const p = F.players[id]; if (p && !p.inj && p.pos !== 'k' && ((t.state === 'rebuild' && p.age >= 28 && p.ovr >= 78) || (t.state === 'retool' && p.age >= 30 && p.ovr >= 80 && p.con && p.con.yrs <= 1) || p.want || p.block)) league.push(p) }
  }
  league.sort((a, b) => b.ovr - a.ovr)
  return { mine: mineP.map(p => playerRow(F, p)), league: league.slice(0, 30).map(p => ({ ...playerRow(F, p), teamState: F.teams[p.team].state ?? 'retool', asking: playerValue(F, p) >= 1300 ? 'A first-round pick' : playerValue(F, p) >= 500 ? 'A second-round pick' : playerValue(F, p) >= 200 ? 'A third-round pick' : 'A late-round pick', value: playerValue(F, p) })),
    offers: (F.offers ?? []).map(o => offerRow(F, o)), open: tradesOpen(F), deadlineWeek: TRADE_DEADLINE }
}
export function freeAgents(F, { slot = null, n = 60 } = {}) {
  const fit = p => clamp(Math.round(55 + (F.teams[F.team].rec ? (pct(F.teams[F.team].rec.w, F.teams[F.team].rec.l, 0) - 0.5) * 30 : 0)), 5, 99)
  return F.fa.map(id => F.players[id]).filter(p => p && (!slot || slotOf(p) === slot)).sort((a, b) => b.ovr - a.ovr).slice(0, n).map(p => ({ ...playerRow(F, p), ask: F.phase === 'offseason' ? askOf(F, p) : streetAsk(F, p), interest: p.ovr >= 78 ? 3 : p.ovr >= 72 ? 1 : 0, fit: fit(p) }))
}

// ── History ──────────────────────────────────────────────────────────────────
export function history(F) {
  const H = F.hist, g = F.gm
  const legacy = clamp(Math.round((g.rings ?? 0) * 22 + (g.pw ?? 0) * 3 + pct(g.w, g.l, g.t) * 40 * Math.min(1, (g.seasons?.length ?? 0) / 4) + (g.seasons?.length ?? 0) * 1.2), 0, 100)
  const word = legacy >= 85 ? 'All-time great' : legacy >= 65 ? 'Among the best in the business' : legacy >= 45 ? 'Respected' : legacy >= 25 ? 'Established' : 'Still proving it'
  const resume = []
  if (g.seasons?.length) resume.push(`${g.seasons.length} season${g.seasons.length > 1 ? 's' : ''} as a general manager`, `${g.w}-${g.l}${g.t ? `-${g.t}` : ''} in the regular season, ${g.pw ?? 0}-${g.pl ?? 0} in the playoffs`)
  if (g.rings) resume.push(`${g.rings} championship${g.rings > 1 ? 's' : ''} (${g.seasons.filter(s => s.champ).map(s => s.year).join(', ')})`)
  const po = (g.seasons ?? []).filter(s => s.seed).length
  if (po) resume.push(`${po} playoff appearance${po > 1 ? 's' : ''}`)
  if (g.fired) resume.push(`Let go ${g.fired === 1 ? 'once' : `${g.fired} times`}`)
  return {
    seasons: [...(H.seasons ?? [])].reverse().map(s => ({ year: s.year, champion: teamRef(s.champ), runnerUp: teamRef(s.runner), score: s.score, awards: s.awards, allPro: s.allPro, user: s.user })),
    records: { season: recordRows(H.records?.season), game: recordRows(H.records?.game), team: recordRows(H.records?.team) },
    gm: { name: g.name, seasons: g.seasons?.length ?? 0, record: `${g.w}-${g.l}${g.t ? `-${g.t}` : ''}`, playoffs: `${g.pw ?? 0}-${g.pl ?? 0}`, rings: g.rings ?? 0, titles: (g.seasons ?? []).filter(s => s.champ).map(s => s.year), security: Math.round(g.security), legacy, legacyWord: word, résumé: resume, resume, teams: [...new Set((g.seasons ?? []).map(s => s.team))] },
    hall: H.hall ?? [],
  }
}
const recordRows = m => Object.entries(m ?? {}).map(([key, r]) => ({ key, label: r.label, val: r.val, name: r.name, team: r.team, year: r.year }))
export { lineText, statLine, lastName, archOf, coachOvr, DEV, OL_SPOTS, nick, teamName, recText, weekGames, staffEffects }
