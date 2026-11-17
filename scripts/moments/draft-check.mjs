// Career's football draft, many nights at once (lib/career.js nflDraft): who lands where, by position and stock.
// Checks the landing team needs his spot, the quarterback-needy teams take the quarterbacks (and a team with its
// own never does early), backs and tight ends rarely go top 10, the interviews move one team's odds the way they
// should, and what sitting out the combine costs. Run from the repo root:  node scripts/moments/draft-check.mjs [nights]
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
await C.loadDraftClass()
const N = Number(process.argv[2] ?? 40)
const S = C.SPORT.nfl
const TEAMS = S.teams.map(t => t.short)
let fails = 0
const ok = (cond, what) => { if (!cond) { fails++; console.log('  FAIL', what) } }
const pct = (a, b) => (b ? `${Math.round(100 * a / b)}%` : '-')

// a build at a position (and a board spot: cb/s, edge/dt, ot/og/c), its traits moved to about the overall asked for
const POS_OF = { qb: 'qb', rb: 'rb', wr: 'wr', te: 'te', cb: 'db', s: 'db', edge: 'dl', dt: 'dl', lb: 'lb', ot: 'ol', og: 'ol', c: 'ol', k: 'k' }
function career(group, seed, ovr = null) {
  const pos = POS_OF[group], pool = S.pool[pos].filter(p => p.attrs)
  for (let t = 0; t < 400; t++) {
    const r = seeded(`dchk-${group}-${seed}-${t}`)
    const b = {}
    const anchor = pool[Math.floor(r() * pool.length)]
    for (const tr of S.types[pos]) {
      const p = tr === 'size' ? anchor : pool[Math.floor(r() * pool.length)]
      b[tr] = { type: tr, val: p.attrs?.[tr] ?? 5, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }
    }
    let c = C.newCareer({ sport: 'nfl', pos, build: b, name: 'Cole Norwood', owner: 'Guest', games: 'off' })
    if (C.draftGroup(c) !== group) continue
    if (ovr != null) {
      for (let k = 0; k < 30 && Math.abs(c.ovr - ovr) > 1; k++) {
        const d = c.ovr < ovr ? 1 : -1
        const tr = S.types[pos][Math.floor(r() * S.types[pos].length)]
        if (tr === 'size') continue
        b[tr] = { ...b[tr], val: Math.max(0, Math.min(11, b[tr].val + d)) }
        c = { ...c, build: b, base: b, ovr: S.ovr(pos, b) }
      }
      if (Math.abs(c.ovr - ovr) > 1) continue
    }
    return { ...c, seed: `dchk${group}${seed}x` }
  }
  return null
}
// a career at a projected window (the college projection stockOf starts from), no combine, no interviews
const atStock = (c, lo, hi) => ({ ...c, college: { proj: [lo, hi] }, draft: { ...c.draft, combine: [] } })
const need = (t, g) => C.draftNeeds(t).need[g] ?? 0
const needRank = (t, g) => 1 + TEAMS.filter(x => need(x, g) > need(t, g)).length

// ── The order and the needs ──
const night0 = C.draftNight(atStock(career('k', 0), 223, 224))
console.log('ROUND 1 as the board runs with nobody in it (a kicker at the end):')
console.log(night0.ticker.slice(0, 32).map(p => `${p.o} ${p.team} ${p.pos} ${p.player}${p.col ? ` (${p.col})` : ''}${p.real ? ' *' : ''}`).join(' | '))
console.log('QB needs:', TEAMS.map(t => `${t}${C.draftNeeds(t).franchise ? '(F)' : ''} ${need(t, 'qb').toFixed(1)}`).join(', '))

// ── The board's own picks (a deep draft, many classes): positional value and quarterbacks ──
{
  let top10 = 0, rbte10 = 0, k100 = 0, qbR1 = 0, qbR1needy = 0, qbFranchiseEarly = 0, picks = 0
  for (let i = 0; i < N; i++) {
    const n = C.draftNight(atStock(career('k', 100 + i), 223, 224))
    for (const p of n.ticker) {
      picks++
      if (p.o <= 10) { top10++; if (p.pos === 'RB' || p.pos === 'TE') rbte10++ }
      if (p.pos === 'K' && p.o <= 100) k100++
      if (p.pos === 'QB' && p.o <= 32) { qbR1++; if (need(p.team, 'qb') >= 1.8) qbR1needy++ }
      if (p.pos === 'QB' && p.o <= 64 && C.draftNeeds(p.team).franchise) qbFranchiseEarly++
    }
  }
  console.log(`\nBOARD (${N} drafts, everyone else): RB/TE in the top 10 ${pct(rbte10, top10)} (real class has Love at 3) · kickers before 100: ${k100} · R1 QBs by QB-needy teams ${pct(qbR1needy, qbR1)} of ${qbR1} · QBs to teams with their own in rounds 1-2: ${qbFranchiseEarly}`)
  ok(qbFranchiseEarly === 0, 'a team with its quarterback took one in the first two rounds')
}

// ── The player, by position and stock ──
const LEVELS = [['top 10', 1, 10], ['mid 1st', 10, 24], ['late 1st-2nd', 24, 50], ['Day 2', 50, 100], ['Day 3', 100, 180]]
console.log('\nTHE PLAYER: the landing team\'s need at his spot (0-4, the league\'s average in brackets) · % landing at a team in the top half of need among the teams that picked from his window\'s start to his pick · mean pick')
const rows = []
for (const g of ['qb', 'rb', 'wr', 'te', 'ot', 'og', 'c', 'edge', 'dt', 'lb', 'cb', 's']) {
  const avg = TEAMS.reduce((s, t) => s + need(t, g), 0) / 32
  const cells = []
  for (const [lab, lo, hi] of LEVELS) {
    let n = 0, sumNeed = 0, topHalf = 0, sumPick = 0, franchiseQB = 0, needyQB = 0, inWin = 0
    for (let i = 0; i < N; i++) {
      const c0 = career(g, i)
      if (!c0) continue
      const c = C.runDraft(atStock(c0, lo, hi))
      const t = c.team, o = c.draft.pick.o
      const pool = [...new Set(C.draftNight({ ...atStock(c0, lo, hi) }).ticker.filter(p => p.o >= lo).map(p => p.team))]
      const winNeeds = [...new Set([...pool, t])].map(x => need(x, g)).sort((a, b) => a - b), med = winNeeds[Math.floor(winNeeds.length / 2)]
      n++; sumNeed += need(t, g); if (need(t, g) >= med) topHalf++; sumPick += o
      if (o >= lo - 3 && o <= hi + 3) inWin++
      if (g === 'qb' && o <= 64 && C.draftNeeds(t).franchise) franchiseQB++
      if (g === 'qb' && need(t, 'qb') >= 1.8) needyQB++
    }
    cells.push(`${lab}: need ${(sumNeed / n).toFixed(1)} · ${pct(topHalf, n)} · pick ${Math.round(sumPick / n)}${g === 'qb' ? ` · to QB-needy ${pct(needyQB, n)}` : ''}`)
    rows.push({ g, lab, need: sumNeed / n, avg, topHalf: topHalf / n, inWin: inWin / n })
    if (g === 'qb') ok(franchiseQB === 0, `QB ${lab}: ${franchiseQB} went in rounds 1-2 to a team with its quarterback`)
  }
  console.log(`${g.toUpperCase().padEnd(4)} (league ${avg.toFixed(1)}) ${cells.join(' | ')}`)
}
const all = rows.reduce((s, x) => s + x.topHalf, 0) / rows.length
console.log(`landing at a top-half need overall: ${Math.round(all * 100)}% · inside the window (±3): ${Math.round(rows.reduce((s, x) => s + x.inWin, 0) / rows.length * 100)}%`)
ok(all >= 0.65, 'landing team needs his spot in most cases')

// ── Backs and tight ends at the top: by overall, from the build's own stock ──
console.log('\nTOP-10 PICKS by overall (the build\'s own stock, an average combine):')
for (const g of ['qb', 'wr', 'edge', 'rb', 'te', 's']) {
  const cells = []
  for (const ovr of [88, 92, 95, 98]) {
    let n = 0, t10 = 0, first = 0
    for (let i = 0; i < N; i++) {
      const c0 = career(g, 500 + i, ovr)
      if (!c0) continue
      const c = C.runDraft({ ...c0, draft: { ...c0.draft, combine: c0.draft.combine.map(d => ({ ...d, score: 0.6, pct: 0, text: '-' })) } })
      n++; if (c.draft.pick.o <= 10) t10++; if (c.draft.pick.o === 1) first++
    }
    cells.push(`${ovr}: top10 ${pct(t10, n)}, No.1 ${pct(first, n)}`)
  }
  console.log(`${g.toUpperCase().padEnd(4)} ${cells.join(' | ')}`)
}

// ── Interviews: one team's answer against the same night ──
console.log('\nINTERVIEWS: chance a team he sat with drafts him, by how that interview went (his other rooms not held)')
for (const [g, lo, hi] of [['wr', 12, 28], ['qb', 5, 20], ['edge', 30, 60], ['cb', 60, 110]]) {
  const cnt = { good: 0, neutral: 0, none: 0, skip: 0, bad: 0 }; let n = 0
  for (let i = 0; i < N * 6; i++) {
    const c0 = career(g, 900 + i)
    if (!c0) continue
    const c1 = C.setupInterviews(atStock(c0, lo, hi))
    const ints = c1.draft.interviews
    n++
    for (const mode of Object.keys(cnt)) {
      const first = ints[0]
      const k = mode === 'good' ? first.a.findIndex(a => a.stock === 2) : mode === 'neutral' ? first.a.findIndex(a => a.stock === 1) : mode === 'none' ? null : mode === 'bad' ? first.a.findIndex(a => a.stock < 0) : C.SKIP_TALK
      // (the other three rooms never happened: only this one's read moves)
      const list = [{ ...first, answer: mode === 'skip' ? C.SKIP_TALK : k != null && k < 0 ? 0 : k }, ...ints.slice(1).map(x => ({ ...x, answer: null }))]
      const c = C.runDraft({ ...c1, draft: { ...c1.draft, interviews: list }, college: { proj: [lo, hi] } })
      if (c.team === first.team) cnt[mode]++
    }
  }
  console.log(`${g.toUpperCase()} [${lo}-${hi}] n=${n}: loved it ${pct(cnt.good, n)} · liked it ${pct(cnt.neutral, n)} · no interview ${pct(cnt.none, n)} · skipped ${pct(cnt.skip, n)} · turned off ${pct(cnt.bad, n)}`)
  ok(cnt.good > cnt.neutral && cnt.neutral > cnt.none && cnt.none >= cnt.skip && cnt.skip >= cnt.bad && cnt.none > cnt.bad, `${g}: interview odds out of order`)
}

// ── The combine sat out ──
console.log('\nCOMBINE SKIPPED vs an average workout (the build\'s own stock): mean pick, spread (sd)')
for (const g of ['qb', 'wr', 'edge', 'cb', 'rb']) {
  const cells = []
  for (const ovr of [95, 90, 85, 80]) {
    const A = [], B = []
    for (let i = 0; i < N; i++) {
      const c0 = career(g, 1500 + i, ovr)
      if (!c0) continue
      A.push(C.runDraft({ ...c0, draft: { ...c0.draft, combine: c0.draft.combine.map(d => ({ ...d, score: 0.6, pct: 0, text: '-' })) } }).draft.pick.o)
      B.push(C.runDraft(C.skipCombine(c0)).draft.pick.o)
    }
    const m = a => a.reduce((s, x) => s + x, 0) / a.length, sd = a => Math.sqrt(a.reduce((s, x) => s + (x - m(a)) ** 2, 0) / a.length)
    cells.push(`${ovr}: ${Math.round(m(A))}→${Math.round(m(B))} (sd ${Math.round(sd(A))}→${Math.round(sd(B))})`)
  }
  console.log(`${g.toUpperCase().padEnd(4)} ${cells.join(' | ')}`)
}

console.log(fails ? `\n${fails} FAILED` : '\nall draft checks passed')
await server.close()
process.exit(fails ? 1 : 0)
