// FRANCHISE: a game's scoring summary, the way the broadcast and the box score read it.
// The game (game.js) decides when each score happens and what it was (a touchdown and its try, a field goal from
// a spot); this names it: who threw it, who caught it, who ran it in, who kicked it, and how far.
//   "Bo Nix 18-yd pass to Courtland Sutton" · "Javonte Williams 3-yd run" · "Wil Lutz 47-yd field goal"
// The player's team: the scorers come out of its own box score for the game (the men who caught and carried the ball
// that day), and the box's touchdowns are then set from the summary, so the two always agree. The other team: its
// league box score for the week when there is one (stats.js gameLines), otherwise its depth chart.
// The moment (the key play) reads as the play it was: a conversion on third down, a sack, a pick, a stop.
import { startersOf } from './roster'
import { KS } from '../../data/ks'
import { rngOf, clamp } from './rng'

const REG = 3600, Q = 900
const DOWN = ['', '1st', '2nd', '3rd', '4th']
// a play's place on the clock, the way it's printed: "Q4 2:14", "OT 6:30". A play that ends right on a quarter's
// last tick is that quarter's 0:00 (the end of the half reads "Q2 0:00", never "Q3 15:00"). po: a playoff game's
// overtime periods are 15 minutes, the regular season's 10.
const mmss = left => `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`
export function whenOf(t, po = false) {
  if (t > REG) {
    const len = po ? 900 : 600, into = t - REG, n = Math.ceil(into / len) - 1
    return `${n > 0 ? `${n + 1}OT` : 'OT'} ${mmss(len - (into - n * len))}`
  }
  const q = t > 0 ? Math.min(3, Math.ceil(t / Q) - 1) : 0, left = Q - (t - q * Q)
  return `Q${q + 1} ${mmss(left)}`
}
const KICKER = new Map()
const kickerOf = short => { if (!KICKER.has(short)) KICKER.set(short, KS.find(k => k.team === short)?.name ?? null); return KICKER.get(short) }

// The men a side can score with, from a box score: { pass: [[id, n]], run: [[id, n]], ry: {id: yds}, rec: {id: yds}, rc: {id: catches} }
function creditsOf(lines) {
  const out = { pass: [], run: [], yd: {}, rc: {} }
  for (const [id, x] of Object.entries(lines ?? {})) {
    if (x.rctd) out.pass.push([id, x.rctd])
    if (x.rtd) out.run.push([id, x.rtd])
    out.yd[id] = { rec: x.ryd ?? 0, run: x.ry ?? 0 }
    if (x.rc) out.rc[id] = x.rc
  }
  return out
}
const take = (list, R) => {
  const all = list.flatMap(([id, n]) => Array(n).fill(id))
  if (!all.length) return null
  const id = all[Math.floor(R.u() * all.length)]
  const e = list.find(x => x[0] === id); e[1]--
  if (!e[1]) list.splice(list.indexOf(e), 1)
  return id
}
const pickW = (R, items) => { const tot = items.reduce((a, [, w]) => a + w, 0); let u = R.u() * tot; for (const [x, w] of items) { u -= w; if (u <= 0) return x } return items[items.length - 1]?.[0] ?? null }
// how far: most touchdown catches are short, a few go a long way; most touchdown runs are inside the 5
const passYds = R => clamp(1, 85, 1 + Math.floor(-Math.log(1 - R.u() * 0.999) * 12))
const runYds = R => clamp(1, 75, 1 + Math.floor(-Math.log(1 - R.u() * 0.999) * 4.5))

// A side for the summary: its starters (who's on the field) and how it scores
function sideOf(F, short, lines) {
  const L = startersOf(F, short)
  const by = new Map(F.teams[short].r.map(p => [String(p.i), p]))
  return { short, L, by, cr: creditsOf(lines), used: {} }
}
// the receivers a quarterback looks for, by how much of the ball each gets
const TARGETS = [['wr1', 0.3], ['wr2', 0.22], ['te1', 0.19], ['wr3', 0.13], ['rb1', 0.1]]
function scorer(Sd, R, pass) {
  if (pass) {
    const id = take(Sd.cr.pass, R)
    if (id && Sd.by.get(id)) return Sd.by.get(id)
    return pickW(R, TARGETS.filter(([k]) => Sd.L[k]).map(([k, w]) => [Sd.L[k], w]))
  }
  const id = take(Sd.cr.run, R)
  if (id && Sd.by.get(id)) return Sd.by.get(id)
  return pickW(R, [[Sd.L.rb1, 0.82], [Sd.L.qb1, 0.18]].filter(([p]) => p))
}
// yards, kept inside what the box says he gained that day and inside the field from where the scoring play started
// (cap: that spot to the goal line)
function yardsFor(Sd, p, kind, R, cap = 99) {
  let y = Math.min(cap, kind === 'rec' ? passYds(R) : runYds(R))
  const tot = Sd.cr.yd[String(p.i)]?.[kind]
  if (tot != null && tot > 0) {
    const left = Math.max(1, tot - (Sd.used[`${p.i}${kind}`] ?? 0))
    y = Math.max(1, Math.min(y, left))
  }
  Sd.used[`${p.i}${kind}`] = (Sd.used[`${p.i}${kind}`] ?? 0) + y
  return y
}
const tryText = tr => (tr === 'xpx' ? ' (kick no good)' : tr === '2' ? ' (two-point try good)' : tr === '2x' ? ' (two-point try failed)' : '')

// ── The summary ──────────────────────────────────────────────────────────────
// S: the finished game · us: 'h' | 'a' (the player's team) · box: the player's box score (`p{id}` → line) ·
// oppLines: the other team's line for the game (id → line) or null · mo: the moment { pid, game, hit, line, kind }
// Returns [[t, mine, pts, text]] in order, and sets the player's box touchdowns from it.
// obox: the other team's box (`p{id}` → line), when the game has one: its touchdowns are set from the summary too.
export function scoringSummary(F, S, us, box, oppLines, mo = null, { pre = null, credits = false, obox = null } = {}) {
  const R = rngOf(`${S.G.seed}-summary`)
  const shortOf = side => S.G[side]
  const them = us === 'h' ? 'a' : 'h'
  const idLines = b => Object.fromEntries(Object.entries(b ?? {}).map(([k, v]) => [k.slice(1), v]))
  const sides = { [us]: sideOf(F, shortOf(us), idLines(box)), [them]: sideOf(F, shortOf(them), obox ? idLines(obox) : oppLines) }
  // each side's scorers: id → { ptd, rctd, rtd, and the yards of the scoring catches and runs }
  const credit = { [us]: {}, [them]: {} }
  const tally = (side, id, k, y = 0) => { const c = credit[side][id] ??= { ptd: 0, rctd: 0, rtd: 0, rcy: 0, ry: 0 }; c[k]++; if (k === 'rctd') c.rcy += y; if (k === 'rtd') c.ry += y }
  let cur = []
  const give = (p, k, side, y = 0) => { if (!p) return; tally(side, p.i, k, y); cur.push([p.i, k, y]) }
  const out = []
  // (pre: the plays already named before the moment (the live feed showed them): kept as they were, credits and all)
  let pj = 0
  const preTD = pre?.filter(x => x[2] >= 6)

  for (let i = 0; i < S.plays.length; i++) {
    const pl = S.plays[i], Sd = sides[pl.s], mine = pl.s === us ? 1 : 0
    if (pl.k === 'fg') {
      // (the man who kicked it: the game's own kicker for that side; an old game without one, the team's real K)
      const k = Sd.by.get(String(S.G.kid?.[pl.s]))?.n ?? kickerOf(Sd.short), d = clamp(18, 70, 117 - (pl.y ?? 70))
      out.push([pl.t, mine, pl.p, `${k ?? `${Sd.short}`} ${d}-yd field goal`])
      continue
    }
    if (pl.k === 'key') { const x = keyText(F, S, pl, sides, us, mo, R); if (x) out.push([pl.t, mine, 0, x]); continue }
    // a moment's snap: the play as the screen named it (moments.js)
    if (pl.k === 'snap') { if (pl.txt) out.push([pl.t, mine, 0, pl.txt]); continue }
    if (pl.k !== 'td') continue
    const was = preTD?.[pj]
    if (was && was[0] === pl.t && was[2] === pl.p) {
      pj++
      // (an old save's named plays carry the player's side only: [id, k]; now both sides, with the yards)
      for (const [id, k, y] of was[4] ?? []) tally(pl.s, id, k, y ?? 0)
      out.push(credits ? was : was.slice(0, 4))
      continue
    }
    cur = []
    // the moment's own touchdown: the build in it scored it (a quarterback threw it, a lineman's back ran behind him)
    let txt
    // (a moment's touchdown: named by the play, and the men in it credited; his yards are already on his line)
    if (pl.txt) { txt = pl.txt; for (const [id, k] of pl.cr ?? []) { tally(pl.s, id, k); cur.push([id, k, 0]) } }
    else if (pl.key && mo && mine) txt = momentTD(F, Sd, mo, R, give, us)
    if (!txt) {
      const qb = Sd.L.qb1
      const pass = Sd.cr.pass.length ? (Sd.cr.run.length ? R.u() < 0.6 : true) : Sd.cr.run.length ? false : R.u() < 0.62
      const p = scorer(Sd, R, pass)
      // (no longer than the field from where the scoring play started: game.js keeps the spot, fy)
      const cap = pl.fy != null ? Math.max(1, 100 - pl.fy) : 99
      if (pass && qb && p && p !== qb) { const y = yardsFor(Sd, p, 'rec', R, cap); txt = `${qb.n} ${y}-yd pass to ${p.n}`; give(qb, 'ptd', pl.s); give(p, 'rctd', pl.s, y) }
      else if (p) { const y = yardsFor(Sd, p, 'run', R, cap); txt = `${p.n} ${y}-yd run`; give(p, 'rtd', pl.s, y) }
      else txt = `${Sd.short} touchdown`
    }
    out.push(credits ? [pl.t, mine, pl.p, txt + tryText(pl.tr), cur] : [pl.t, mine, pl.p, txt + tryText(pl.tr)])
  }

  // each box's touchdowns are the summary's (a scorer the box had without a catch or a carry gets the play's)
  const setTDs = (b, cs) => {
    if (!b) return
    for (const x of Object.values(b)) { if (x.ptd || x.rctd || x.rtd || x.p6) { x.ptd = 0; x.rctd = 0; x.rtd = 0; x.p6 = 0 } }
    for (const [id, c] of Object.entries(cs)) {
      const x = b[`p${id}`] ??= {}
      x.ptd = (x.ptd ?? 0) + c.ptd; x.rctd = (x.rctd ?? 0) + c.rctd; x.rtd = (x.rtd ?? 0) + c.rtd
      if (c.rctd > (x.rc ?? 0)) { if (!x.rc) x.ryd = (x.ryd ?? 0) + c.rcy; x.rc = c.rctd; x.tg = Math.max(x.tg ?? 0, c.rctd) }
      if (c.rtd > (x.ra ?? 0)) { if (!x.ra) x.ry = (x.ry ?? 0) + c.ry; x.ra = c.rtd }
    }
  }
  setTDs(box, credit[us]); setTDs(obox, credit[them])
  return out
}

// the moment's touchdown, by who the build is
function momentTD(F, Sd, mo, R, give, us) {
  const me = Sd.by.get(String(mo.pid)), qb = Sd.L.qb1
  if (!me) return null
  const d = Math.max(1, mo.togo ?? 5)
  if (me.p === 'qb') {
    if (mo.game === 'sneak' || (mo.game === 'goal-line' && d <= 2 && R.u() < 0.4)) { give(me, 'rtd', us); return `${me.n} ${d}-yd run` }
    const to = scorer(Sd, R, true)
    if (to && to !== me) { give(me, 'ptd', us); give(to, 'rctd', us); return `${me.n} ${d}-yd pass to ${to.n}` }
    give(me, 'rtd', us); return `${me.n} ${d}-yd run`
  }
  if (me.p === 'rb' && mo.game !== 'catch') { give(me, 'rtd', us); return `${me.n} ${d}-yd run` }
  if (me.p === 'wr' || me.p === 'te' || me.p === 'rb') {
    if (qb) { give(qb, 'ptd', us); give(me, 'rctd', us); return `${qb.n} ${d}-yd pass to ${me.n}` }
  }
  if (me.p === 'ol') { const rb = Sd.L.rb1; if (rb) { give(rb, 'rtd', us); return `${rb.n} ${d}-yd run behind ${me.n}` } }
  return null
}

// the key play when it isn't its own touchdown: the conversion, the stop, the pick, the sack
function keyText(F, S, pl, sides, us, mo, R) {
  if (!mo) return null
  const them = us === 'h' ? 'a' : 'h', U = sides[us], T = sides[them]
  const me = U.by.get(String(mo.pid))
  if (!me) return null
  const dd = `on ${DOWN[mo.down]} & ${mo.goal ? 'goal' : mo.d}`
  const line = mo.line
  if (mo.ball === 'us') {
    // a touchdown right on the play reads as the touchdown itself (the next entry)
    if (line === 'td') return null
    const qb = U.L.qb1, gain = mo.d + R.int(0, 9)
    if (mo.hit) {
      if (me.p === 'qb') { const to = scorer({ ...U, cr: { pass: [], run: [] } }, R, true); return to && to !== me ? `${me.n} ${gain}-yd pass to ${to.n} ${dd}` : `${me.n} ${gain}-yd run ${dd}` }
      if (me.p === 'rb') return `${me.n} ${gain}-yd run ${dd}`
      if (me.p === 'ol') return `${U.L.rb1?.n ?? 'Run'} ${gain}-yd run behind ${me.n} ${dd}`
      return qb ? `${qb.n} ${gain}-yd pass to ${me.n} ${dd}` : `${me.n} ${gain}-yd catch ${dd}`
    }
    if (line === 'pick' || mo.kind === 'pick') { const d = T.L.cb1 ?? T.L.s1; return `${(me.p === 'qb' ? me : qb)?.n ?? 'Pass'} intercepted by ${d?.n ?? T.short}` }
    if (me.p === 'qb') return `${me.n} pass incomplete ${dd}`
    if (me.p === 'rb') return `${me.n} stopped short ${dd}`
    if (me.p === 'ol') { const e = T.L.edge1 ?? T.L.dt1; return `${e?.n ?? T.short} sacks ${qb?.n ?? 'the QB'} ${dd}` }
    return qb ? `${qb.n} pass incomplete to ${me.n} ${dd}` : `Pass incomplete to ${me.n} ${dd}`
  }
  // on defense
  const oq = T.L.qb1, orb = T.L.rb1, owr = T.L.wr1
  if (mo.hit) {
    if (line === 'pick') return `${me.n} intercepts ${oq?.n ?? T.short}`
    if (mo.game === 'pass-rush') return `${me.n} sacks ${oq?.n ?? T.short} ${dd}`
    if (mo.game === 'run-stuff' || mo.game === 'tackle-angle' || mo.game === 'hit-stick') return `${me.n} stops ${(mo.d <= 3 ? orb : owr)?.n ?? T.short} short ${dd}`
    return `${me.n} breaks up a pass for ${owr?.n ?? T.short} ${dd}`
  }
  if (line === 'td' || line === 'conv-td') return line === 'td' ? null : `${oq?.n ?? T.short} ${mo.d + R.int(0, 12)}-yd pass to ${(owr ?? orb)?.n ?? T.short} ${dd}`
  return `${oq?.n ?? T.short} ${mo.d + R.int(0, 12)}-yd pass to ${(T.L.te1 ?? owr)?.n ?? T.short} ${dd}`
}
